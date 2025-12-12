require('dotenv').config();

module.exports = {
    // Telegram Bot Configuration
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    ADMIN_CHAT_IDS: process.env.ADMIN_CHAT_IDS ? process.env.ADMIN_CHAT_IDS.split(',') : [],
    
    // Target Countries Configuration
    COUNTRIES: {
        'USA': {
            code: '+1',
            name: 'United States',
            searchTerms: ['usa', 'united states', 'us', 'america']
        },
        'UK': {
            code: '+44',
            name: 'United Kingdom',
            searchTerms: ['uk', 'united kingdom', 'britain', 'england']
        },
        'AUSTRALIA': {
            code: '+61',
            name: 'Australia',
            searchTerms: ['australia', 'aus', 'au', 'sydney', 'melbourne']
        },
        'SPAIN': {
            code: '+34',
            name: 'Spain',
            searchTerms: ['spain', 'españa', 'spanish', 'madrid', 'barcelona']
        },
        'MEXICO': {
            code: '+52',
            name: 'Mexico',
            searchTerms: ['mexico', 'méxico', 'mexican', 'cdmx', 'guadalajara']
        }
    },
    
    // Categories Configuration
    CATEGORIES: {
        'CRYPTO': [
            'crypto', 'bitcoin', 'ethereum', 'binance', 'coinbase',
            'blockchain', 'defi', 'nft', 'airdrop', 'token'
        ],
        'TRADING': [
            'trading', 'forex', 'signals', 'stocks', 'invest',
            'investment', 'trading signals', 'forex signals'
        ],
        'EARNING': [
            'earn', 'earning', 'money making', 'passive income',
            'online income', 'make money', 'side hustle'
        ],
        'GROUPS': [
            'group', 'community', 'channel', 'telegram group',
            'whatsapp group', 'join group'
        ]
    },
    
    // Search Phrases
    SEARCH_PHRASES: [
        'whatsapp me for crypto signals',
        'dm me on whatsapp for trading',
        'contact me on whatsapp for investment',
        'crypto group join whatsapp',
        'earn money whatsapp number',
        'binance signal group whatsapp',
        'whatsapp for trading tips',
        'join whatsapp for airdrop',
        'whatsapp crypto community',
        'whatsapp number for forex signals'
    ],
    
    // Platform Configuration
    PLATFORMS: {
        'facebook': {
            enabled: true,
            rateLimit: 5, // requests per minute
            baseUrl: 'https://www.facebook.com/public/'
        },
        'twitter': {
            enabled: true,
            rateLimit: 10,
            baseUrl: 'https://twitter.com/search?q='
        },
        'instagram': {
            enabled: true,
            rateLimit: 3,
            baseUrl: 'https://www.instagram.com/explore/tags/'
        },
        'youtube': {
            enabled: true,
            rateLimit: 5,
            baseUrl: 'https://www.youtube.com/results?search_query='
        },
        'telegram': {
            enabled: true,
            rateLimit: 15
        },
        'reddit': {
            enabled: true,
            rateLimit: 10,
            baseUrl: 'https://www.reddit.com/r/'
        }
    },
    
    // Validation Rules
    VALIDATION: {
        minNumberLength: 10,
        maxNumberLength: 15,
        allowedCountries: ['+1', '+44', '+61', '+34', '+52'],
        requireCategoryMatch: true,
        deduplicate: true,
        verifyPattern: true
    },
    
    // Storage Configuration
    STORAGE: {
        dataFile: './data/collected_data.json',
        pdfDirectory: './data/reports/',
        logFile: './logs/bot.log',
        maxEntries: 10000
    },
    
    // Bot Settings
    BOT_SETTINGS: {
        defaultCollectionTime: 3600, // 1 hour in seconds
        maxCollectionTime: 86400, // 24 hours
        pdfExportLimit: 1000,
        autoSaveInterval: 300 // 5 minutes
    }
};
