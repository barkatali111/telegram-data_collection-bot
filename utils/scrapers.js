const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

class PublicDataScraper {
    constructor() {
        this.browser = null;
        this.rateLimits = new Map();
    }
    
    async init() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
    }
    
    async scrapePublicData(platform, searchTerms) {
        const results = [];
        
        for (const term of searchTerms.slice(0, 5)) { // Limit to 5 terms per cycle
            try {
                await this.delay(this.getRateLimitDelay(platform));
                
                let platformResults = [];
                
                switch (platform) {
                    case 'twitter':
                        platformResults = await this.scrapeTwitter(term);
                        break;
                    case 'facebook':
                        platformResults = await this.scrapeFacebook(term);
                        break;
                    case 'instagram':
                        platformResults = await this.scrapeInstagram(term);
                        break;
                    case 'youtube':
                        platformResults = await this.scrapeYouTube(term);
                        break;
                    case 'reddit':
                        platformResults = await this.scrapeReddit(term);
                        break;
                    default:
                        console.log(`Platform ${platform} not implemented`);
                }
                
                results.push(...platformResults.map(item => ({
                    ...item,
                    searchTerm: term,
                    platform
                })));
                
            } catch (error) {
                console.error(`Error scraping ${platform} for "${term}":`, error.message);
            }
        }
        
        return results;
    }
    
    async scrapeTwitter(searchTerm) {
        const results = [];
        try {
            const page = await this.browser.newPage();
            await page.goto(`https://twitter.com/search?q=${encodeURIComponent(searchTerm)}&f=live`, {
                waitUntil: 'networkidle2'
            });
            
            await page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
            
            const tweets = await page.evaluate(() => {
                const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
                return Array.from(tweetElements).slice(0, 10).map(tweet => {
                    const textElement = tweet.querySelector('[data-testid="tweetText"]');
                    const userElement = tweet.querySelector('[data-testid="User-Name"]');
                    return {
                        content: textElement ? textElement.textContent : '',
                        username: userElement ? userElement.textContent.split('·')[0].trim() : 'Unknown'
                    };
                });
            });
            
            await page.close();
            
            return tweets.filter(tweet => 
                tweet.content.toLowerCase().includes('whatsapp') || 
                /\d{10,}/.test(tweet.content)
            );
            
        } catch (error) {
            console.error('Twitter scrape error:', error.message);
            return [];
        }
    }
    
    async scrapeFacebook(searchTerm) {
        const results = [];
        try {
            // Note: Facebook scraping is complex and may require different approaches
            // This is a simplified example
            const page = await this.browser.newPage();
            
            // Search for public posts (this URL might need adjustment)
            await page.goto(`https://www.facebook.com/public/${encodeURIComponent(searchTerm)}`, {
                waitUntil: 'networkidle2'
            });
            
            await this.delay(2000);
            
            const content = await page.content();
            const $ = cheerio.load(content);
            
            // Extract potential posts (this is a very basic example)
            $('div[data-ad-preview="message"]').each((i, elem) => {
                const text = $(elem).text();
                if (text.toLowerCase().includes('whatsapp')) {
                    results.push({
                        content: text,
                        username: 'Facebook User'
                    });
                }
            });
            
            await page.close();
            
        } catch (error) {
            console.error('Facebook scrape error:', error.message);
        }
        
        return results;
    }
    
    async scrapeInstagram(searchTerm) {
        const results = [];
        try {
            const page = await this.browser.newPage();
            await page.goto(`https://www.instagram.com/explore/tags/${encodeURIComponent(searchTerm.replace(/\s+/g, ''))}/`, {
                waitUntil: 'networkidle2'
            });
            
            await this.delay(3000);
            
            const posts = await page.evaluate(() => {
                const postElements = document.querySelectorAll('article a[href*="/p/"]');
                return Array.from(postElements).slice(0, 5).map(post => {
                    // Instagram content extraction would need more complex handling
                    // This is just a placeholder
                    return {
                        content: 'Instagram post content',
                        username: 'instagram_user'
                    };
                });
            });
            
            await page.close();
            
        } catch (error) {
            console.error('Instagram scrape error:', error.message);
        }
        
        return results;
    }
    
    async scrapeYouTube(searchTerm) {
        const results = [];
        try {
            const response = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const $ = cheerio.load(response.data);
            
            $('div#contents ytd-video-renderer').each((i, elem) => {
                const title = $(elem).find('#video-title').text().trim();
                const description = $(elem).find('#description-text').text().trim();
                const channel = $(elem).find('#channel-name a').text().trim();
                
                const combinedText = `${title} ${description}`.toLowerCase();
                
                if (combinedText.includes('whatsapp') || /\d{10,}/.test(combinedText)) {
                    results.push({
                        content: `${title} - ${description}`,
                        username: channel || 'YouTube Channel'
                    });
                }
            });
            
        } catch (error) {
            console.error('YouTube scrape error:', error.message);
        }
        
        return results.slice(0, 10); // Limit results
    }
    
    async scrapeReddit(searchTerm) {
        const results = [];
        try {
            const response = await axios.get(`https://www.reddit.com/r/all/search.json?q=${encodeURIComponent(searchTerm)}&limit=10&sort=relevance`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            
            const posts = response.data.data.children;
            
            posts.forEach(post => {
                const data = post.data;
                const text = `${data.title} ${data.selftext || ''}`.toLowerCase();
                
                if (text.includes('whatsapp') || /\d{10,}/.test(text)) {
                    results.push({
                        content: `${data.title} - ${data.selftext || ''}`,
                        username: data.author
                    });
                }
            });
            
        } catch (error) {
            console.error('Reddit scrape error:', error.message);
        }
        
        return results;
    }
    
    getRateLimitDelay(platform) {
        const limits = {
            'facebook': 5000,
            'instagram': 7000,
            'twitter': 3000,
            'youtube': 2000,
            'reddit': 1000
        };
        
        return limits[platform] || 2000;
    }
    
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

// Create singleton instance
const scraper = new PublicDataScraper();

// Initialize scraper on module load
scraper.init().catch(console.error);

module.exports = {
    scrapePublicData: async (platform, searchTerms) => {
        return scraper.scrapePublicData(platform, searchTerms);
    }
};
