const path = require('path');
require("dotenv").config({ path: path.join(__dirname, '..', '.env') });
const AnthropicBedrock = require("@anthropic-ai/bedrock-sdk").AnthropicBedrock;
const { convertToUSD } = require('./currency');

const client = new AnthropicBedrock({
  awsAccessKey: process.env.LAUNCHCODE_API_KEY,
  awsRegion: "us-east-1",
  skipAuth: true,
  baseURL: process.env.LAUNCHCODE_BEDROCK_PROXY_URL
});

async function parseReceipt(imageBuffer, mimeType) {
  try {
    const base64Image = imageBuffer.toString('base64');

    const response = await client.messages.create({
      model: 'anthropic.claude-3-haiku-20240307-v1:0',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image
              }
            },
            {
              type: 'text',
              text: `Analyze this receipt image and extract the following information. Return ONLY a valid JSON object with no additional text or explanation.

{
  "date": "YYYY-MM-DD format, or null if not found",
  "amount": numeric value only (no currency symbol), or null if not found,
  "currency": "PHP" or "USD" or other currency code detected, or "PHP" if unclear,
  "description": "brief description of purchase" or null
}

Important:
- For the amount field, follow this priority:
  1. If a TOTAL or GRAND TOTAL exists, use that value
  2. If multiple totals exist, use the final/grand total
  3. If there is NO total line, you MUST add up ALL individual item amounts and return their SUM
- NEVER return just the first item amount - always calculate the total sum of all amounts
- If multiple dates are found, use the EARLIEST date
- Return ONLY the JSON object, no markdown, no explanation`
            }
          ]
        }
      ]
    });

    const content = response.content[0].text.trim();

    // Try to parse the JSON response
    let parsed;
    try {
      // Remove any markdown code blocks if present
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', content);
      return {
        success: false,
        error: 'parse_error',
        message: 'Could not parse receipt data from image'
      };
    }

    // Validate required fields
    if (parsed.amount === null || parsed.amount === undefined) {
      return {
        success: false,
        error: 'no_amount',
        message: 'Could not find total amount on receipt'
      };
    }

    // Convert to USD using real-time rates
    const originalCurrency = (parsed.currency || 'PHP').toUpperCase();
    const conversion = await convertToUSD(parsed.amount, originalCurrency);

    return {
      success: true,
      data: {
        date: parsed.date,
        amount: conversion.amount,
        originalAmount: parsed.amount,
        originalCurrency: originalCurrency,
        wasConverted: conversion.wasConverted,
        conversionRate: conversion.wasConverted ? conversion.rate : null,
        description: parsed.description
      }
    };

  } catch (error) {
    console.error('Error parsing receipt with Claude:', error);

    if (error.status === 401) {
      return {
        success: false,
        error: 'auth_error',
        message: 'Invalid Anthropic API key. Please check ANTHROPIC_API_KEY in .env'
      };
    }

    return {
      success: false,
      error: 'api_error',
      message: `Failed to analyze receipt: ${error.message}`
    };
  }
}

module.exports = {
  parseReceipt
};
