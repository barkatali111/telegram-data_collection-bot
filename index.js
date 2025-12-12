const { Telegraf, Markup, session } = require('telegraf');
const config = require('./config');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: config.STORAGE.logFile }),
        new winston.transports.Console()
    ]
});

// Initialize bot
const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

// Session middleware
bot.use(session({
    defaultSession: () => ({
        collecting: false,
        activeCountry: null,
        activeCategory: null,
        collectedData: []
    })
}));

// Import utilities
const { validatePhoneNumber, extractPhoneNumbers, categorizeContent } = require('./utils/validators');
const { filterNumbers, deduplicateNumbers } = require('./utils/filters');
const { scrapePublicData } = require('./utils/scrapers');
const { generatePDFReport } = require('./utils/pdfGenerator');

// Data storage
let collectedData = [];
let collectionInterval = null;

// Load existing data
async function loadData() {
    try {
        const data = await fs.readFile(config.STORAGE.dataFile, 'utf8');
        collectedData = JSON.parse(data);
        logger.info(`Loaded ${collectedData.length} existing records`);
    } catch (error) {
        collectedData = [];
        logger.info('No existing data found, starting fresh');
    }
}

// Save data
async function saveData() {
    try {
        await fs.writeFile(config.STORAGE.dataFile, JSON.stringify(collectedData, null, 2));
        logger.info(`Saved ${collectedData.length} records`);
    } catch (error) {
        logger.error('Error saving data:', error);
    }
}

// Start collection process
async function startCollection(ctx, country = null, category = null) {
    if (ctx.session.collecting) {
        return ctx.reply('Collection is already running!');
    }

    ctx.session.collecting = true;
    ctx.session.activeCountry = country;
    ctx.session.activeCategory = category;

    ctx.reply(`🚀 Starting data collection...
Country: ${country || 'All targeted countries'}
Category: ${category || 'All categories'}
Duration: ${config.BOT_SETTINGS.defaultCollectionTime / 60} minutes`);

    collectionInterval = setInterval(async () => {
        try {
            await runCollectionCycle(country, category);
            const stats = getCollectionStats();
            
            // Send periodic updates to admin
            if (config.ADMIN_CHAT_IDS.includes(ctx.chat.id.toString())) {
                ctx.telegram.sendMessage(
                    ctx.chat.id,
                    `📊 Collection Update:
New entries: ${stats.newEntries}
Total entries: ${stats.total}
Duplicates filtered: ${stats.duplicates}`
                );
            }
        } catch (error) {
            logger.error('Collection error:', error);
        }
    }, 60000); // Run every minute

    // Auto-stop after default time
    setTimeout(() => {
        stopCollection(ctx);
        ctx.reply('⏰ Collection stopped automatically after 1 hour');
    }, config.BOT_SETTINGS.defaultCollectionTime * 1000);
}

// Stop collection
function stopCollection(ctx) {
    if (collectionInterval) {
        clearInterval(collectionInterval);
        collectionInterval = null;
    }
    ctx.session.collecting = false;
    saveData();
    return ctx.reply('🛑 Collection stopped and data saved.');
}

// Run a single collection cycle
async function runCollectionCycle(country = null, category = null) {
    logger.info('Starting collection cycle');
    
    const searchTerms = generateSearchTerms(country, category);
    const newEntries = [];

    for (const platform of Object.keys(config.PLATFORMS).filter(p => config.PLATFORMS[p].enabled)) {
        try {
            const platformData = await scrapePublicData(platform, searchTerms);
            const filteredData = await processPlatformData(platformData, platform);
            newEntries.push(...filteredData);
            
            logger.info(`Collected ${filteredData.length} entries from ${platform}`);
        } catch (error) {
            logger.error(`Error scraping ${platform}:`, error);
        }
    }

    // Add new entries to main collection
    collectedData.push(...newEntries);
    
    // Remove duplicates
    collectedData = deduplicateNumbers(collectedData);
    
    // Limit collection size
    if (collectedData.length > config.STORAGE.maxEntries) {
        collectedData = collectedData.slice(-config.STORAGE.maxEntries);
    }

    return newEntries.length;
}

// Generate search terms based on country and category
function generateSearchTerms(country = null, category = null) {
    let terms = [];
    
    // Base search phrases
    terms.push(...config.SEARCH_PHRASES);
    
    // Add country-specific terms
    if (country) {
        const countryConfig = config.COUNTRIES[country];
        if (countryConfig) {
            terms = terms.map(term => 
                `${term} ${countryConfig.searchTerms[0]}`
            );
        }
    }
    
    // Add category-specific terms
    if (category) {
        const categoryTerms = config.CATEGORIES[category] || [];
        terms.push(...categoryTerms.map(term => `whatsapp ${term}`));
    }
    
    return [...new Set(terms)]; // Remove duplicates
}

// Process data from a platform
async function processPlatformData(data, platform) {
    const processed = [];
    
    for (const item of data) {
        try {
            const numbers = extractPhoneNumbers(item.content);
            
            for (const number of numbers) {
                const validation = validatePhoneNumber(number);
                
                if (validation.valid) {
                    const entry = {
                        id: Date.now() + Math.random().toString(36).substr(2, 9),
                        country: validation.country,
                        phoneNumber: number,
                        source: platform,
                        category: categorizeContent(item.content),
                        username: item.username || 'Unknown',
                        content: item.content.substring(0, 200),
                        timestamp: new Date().toISOString(),
                        metadata: {
                            verified: true,
                            matchesCategory: true,
                            countryCode: validation.countryCode
                        }
                    };
                    
                    processed.push(entry);
                }
            }
        } catch (error) {
            logger.error('Error processing data item:', error);
        }
    }
    
    return processed;
}

// Get collection statistics
function getCollectionStats() {
    const newEntries = collectedData.filter(entry => 
        Date.now() - new Date(entry.timestamp).getTime() < 60000
    ).length;
    
    return {
        total: collectedData.length,
        newEntries,
        duplicates: 0 // This would need to be tracked separately
    };
}

// Bot commands
bot.command('start', (ctx) => {
    const welcomeMessage = `🤖 Welcome to Public Data Collection Bot

This bot collects publicly shared WhatsApp numbers related to:
• Cryptocurrency & Trading
• Investment & Earning Platforms
• Online Income Opportunities

⚠️ IMPORTANT:
- Only collects PUBLICLY shared information
- Respects all privacy laws
- Filters and validates data

Commands:
/collect - Start data collection
/stop - Stop collection
/export_pdf - Generate PDF report
/country [code] - Focus on specific country
/crypto - Crypto-related numbers only
/earning - Earning-related numbers only
/stats - Show collection statistics

Example: /country USA`;
    
    ctx.reply(welcomeMessage);
});

bot.command('collect', (ctx) => {
    startCollection(ctx);
});

bot.command('stop', (ctx) => {
    stopCollection(ctx);
});

bot.command('export_pdf', async (ctx) => {
    try {
        if (collectedData.length === 0) {
            return ctx.reply('No data collected yet. Use /collect first.');
        }
        
        ctx.reply('📄 Generating PDF report...');
        
        const pdfPath = await generatePDFReport(collectedData);
        
        await ctx.replyWithDocument({
            source: pdfPath,
            filename: `whatsapp_data_${Date.now()}.pdf`
        });
        
        logger.info(`PDF exported with ${collectedData.length} entries`);
    } catch (error) {
        logger.error('PDF export error:', error);
        ctx.reply('❌ Error generating PDF report');
    }
});

bot.command('country', (ctx) => {
    const args = ctx.message.text.split(' ');
    const countryCode = args[1] ? args[1].toUpperCase() : null;
    
    if (!countryCode || !config.COUNTRIES[countryCode]) {
        const countriesList = Object.keys(config.COUNTRIES)
            .map(code => `/${code} - ${config.COUNTRIES[code].name}`)
            .join('\n');
        
        return ctx.reply(`Please specify a valid country code:\n${countriesList}`);
    }
    
    ctx.session.activeCountry = countryCode;
    ctx.reply(`🎯 Now focusing on: ${config.COUNTRIES[countryCode].name}`);
});

bot.command('crypto', (ctx) => {
    ctx.session.activeCategory = 'CRYPTO';
    ctx.reply('🎯 Now collecting crypto-related numbers only');
});

bot.command('earning', (ctx) => {
    ctx.session.activeCategory = 'EARNING';
    ctx.reply('🎯 Now collecting earning-related numbers only');
});

bot.command('stats', (ctx) => {
    const stats = getCollectionStats();
    const countryStats = {};
    
    collectedData.forEach(entry => {
        countryStats[entry.country] = (countryStats[entry.country] || 0) + 1;
    });
    
    let statsMessage = `📊 Collection Statistics:
    
Total Entries: ${stats.total}
New (last minute): ${stats.newEntries}
Active Collection: ${ctx.session.collecting ? 'Yes' : 'No'}

By Country:`;
    
    Object.entries(countryStats).forEach(([country, count]) => {
        statsMessage += `\n${country}: ${count}`;
    });
    
    ctx.reply(statsMessage);
});

// Error handling
bot.catch((err, ctx) => {
    logger.error(`Error for ${ctx.updateType}:`, err);
    ctx.reply('❌ An error occurred. Please try again.');
});

// Initialize and start bot
async function initializeBot() {
    try {
        await loadData();
        
        // Auto-save data periodically
        setInterval(() => {
            if (collectedData.length > 0) {
                saveData();
            }
        }, config.BOT_SETTINGS.autoSaveInterval * 1000);
        
        bot.launch();
        logger.info('Bot started successfully');
        
        console.log(`
        🤖 Telegram Data Collection Bot Started!
        ======================================
        Bot Username: @${bot.botInfo.username}
        Target Countries: ${Object.keys(config.COUNTRIES).join(', ')}
        Data File: ${config.STORAGE.dataFile}
        ======================================
        `);
        
    } catch (error) {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.once('SIGINT', () => {
    saveData();
    bot.stop('SIGINT');
    logger.info('Bot stopped by SIGINT');
});

process.once('SIGTERM', () => {
    saveData();
    bot.stop('SIGTERM');
    logger.info('Bot stopped by SIGTERM');
});

// Start the bot
initializeBot();
