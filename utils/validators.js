const phoneLib = require('phone');
const config = require('../config');

function validatePhoneNumber(number) {
    try {
        // Clean the number
        const cleaned = number.replace(/[^\d+]/g, '');
        
        // Validate with phone library
        const result = phoneLib(cleaned);
        
        if (!result.isValid) {
            return { valid: false, reason: 'Invalid phone number format' };
        }
        
        // Check if country is in target list
        const countryCode = `+${result.countryCode}`;
        const targetCountry = Object.values(config.COUNTRIES).find(
            country => country.code === countryCode
        );
        
        if (!targetCountry) {
            return { valid: false, reason: 'Country not in target list' };
        }
        
        return {
            valid: true,
            formattedNumber: result.phoneNumber,
            country: targetCountry.name,
            countryCode,
            countryTag: Object.keys(config.COUNTRIES).find(
                key => config.COUNTRIES[key].code === countryCode
            )
        };
    } catch (error) {
        return { valid: false, reason: 'Validation error' };
    }
}

function extractPhoneNumbers(text) {
    const phoneRegex = /(?:(?:\+?(\d{1,3}))?[\s.-]?)?(?:\(?(\d{1,4})\)?[\s.-]?)?(\d{1,4})[\s.-]?(\d{1,4})[\s.-]?(\d{1,9})/g;
    const matches = [];
    let match;
    
    while ((match = phoneRegex.exec(text)) !== null) {
        const potentialNumber = match[0];
        if (potentialNumber.length >= 10) {
            matches.push(potentialNumber);
        }
    }
    
    return matches;
}

function categorizeContent(text) {
    const lowerText = text.toLowerCase();
    
    for (const [category, keywords] of Object.entries(config.CATEGORIES)) {
        if (keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
            return category;
        }
    }
    
    return 'GENERAL';
}

module.exports = {
    validatePhoneNumber,
    extractPhoneNumbers,
    categorizeContent
};
