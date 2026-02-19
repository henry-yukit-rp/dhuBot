const axios = require('axios');

// Cache for exchange rates
let ratesCache = {
  rates: {},
  lastUpdated: null,
  baseCurrency: 'USD'
};

// Cache duration in milliseconds (1 hour)
const CACHE_DURATION = 60 * 60 * 1000;

// Fallback rates in case API fails
const FALLBACK_RATES = {
  PHP: 56.0,  // 1 USD = 56 PHP (approximate)
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.0,
  CAD: 1.36,
  AUD: 1.53
};

/**
 * Fetch latest exchange rates from API
 * Using exchangerate-api.com (free, no key required for basic usage)
 */
async function fetchRates() {
  try {
    // Free API endpoint - no key required
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
      timeout: 5000
    });

    ratesCache = {
      rates: response.data.rates,
      lastUpdated: Date.now(),
      baseCurrency: 'USD'
    };

    console.log('Exchange rates updated:', new Date().toISOString());
    return true;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error.message);
    return false;
  }
}

/**
 * Get current exchange rate for a currency to USD
 * @param {string} fromCurrency - Currency code (e.g., 'PHP', 'EUR')
 * @returns {Promise<number>} - Exchange rate (how many of fromCurrency = 1 USD)
 */
async function getRate(fromCurrency) {
  const currency = fromCurrency.toUpperCase();

  // Check if cache is stale or empty
  if (!ratesCache.lastUpdated || Date.now() - ratesCache.lastUpdated > CACHE_DURATION) {
    await fetchRates();
  }

  // Return cached rate or fallback
  if (ratesCache.rates[currency]) {
    return ratesCache.rates[currency];
  }

  // Use fallback if API failed
  if (FALLBACK_RATES[currency]) {
    console.warn(`Using fallback rate for ${currency}`);
    return FALLBACK_RATES[currency];
  }

  // Default to 1 if currency not found (assume USD)
  return 1;
}

/**
 * Convert amount from one currency to USD
 * @param {number} amount - Amount in source currency
 * @param {string} fromCurrency - Source currency code
 * @returns {Promise<{amount: number, rate: number, fromCurrency: string}>}
 */
async function convertToUSD(amount, fromCurrency) {
  const currency = fromCurrency.toUpperCase();

  if (currency === 'USD') {
    return {
      amount: amount,
      rate: 1,
      fromCurrency: 'USD',
      wasConverted: false
    };
  }

  const rate = await getRate(currency);
  const convertedAmount = amount / rate;

  return {
    amount: parseFloat(convertedAmount.toFixed(2)),
    rate: rate,
    fromCurrency: currency,
    wasConverted: true
  };
}

/**
 * Get cached rates info (for debugging/display)
 */
function getRatesInfo() {
  return {
    lastUpdated: ratesCache.lastUpdated ? new Date(ratesCache.lastUpdated).toISOString() : null,
    cacheAge: ratesCache.lastUpdated ? Math.round((Date.now() - ratesCache.lastUpdated) / 1000 / 60) + ' minutes' : 'not cached',
    sampleRates: {
      PHP: ratesCache.rates.PHP || FALLBACK_RATES.PHP,
      EUR: ratesCache.rates.EUR || FALLBACK_RATES.EUR,
      GBP: ratesCache.rates.GBP || FALLBACK_RATES.GBP
    }
  };
}

// Pre-fetch rates on module load
fetchRates();

module.exports = {
  getRate,
  convertToUSD,
  fetchRates,
  getRatesInfo
};
