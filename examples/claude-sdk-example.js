/**
 * Claude SDK Example with Company (LaunchCode/Bedrock) Configuration
 *
 * This file shows how to use your company's Claude Code setup
 * with the Anthropic SDK programmatically.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Anthropic = require('@anthropic-ai/sdk');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

// Load user settings from ~/.claude/settings.json
function loadUserSettings() {
  const settingsPath = path.join(process.env.HOME, '.claude', 'settings.json');
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch (e) {
    console.warn('Could not load user settings:', e.message);
    return {};
  }
}

// Get API key from company's helper script
function getApiKey() {
  // First try environment variable
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }

  // Fall back to company's API key helper
  const helperScript = path.join(process.env.HOME, '.launchcode', 'scripts', 'api_key_helper.js');
  if (fs.existsSync(helperScript)) {
    try {
      return execSync(`node "${helperScript}"`).toString().trim();
    } catch (e) {
      console.warn('API key helper failed:', e.message);
    }
  }

  throw new Error('No API key available');
}

// =============================================================================
// EXAMPLE 1: Basic Usage with Company Bedrock Setup
// =============================================================================

async function basicExample() {
  const settings = loadUserSettings();

  // Use company's Bedrock gateway
  const client = new Anthropic({
    apiKey: getApiKey(),
    baseURL: settings.env?.ANTHROPIC_BEDROCK_BASE_URL || 'https://rocketpartners.launch-code.dev/api/gateway/bedrock'
  });

  const message = await client.messages.create({
    model: settings.model || 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'Hello! Can you tell me a short joke?' }
    ]
  });

  console.log('Response:', message.content[0].text);
  return message;
}

// =============================================================================
// EXAMPLE 2: Streaming Response
// =============================================================================

async function streamingExample() {
  const settings = loadUserSettings();

  const client = new Anthropic({
    apiKey: getApiKey(),
    baseURL: settings.env?.ANTHROPIC_BEDROCK_BASE_URL
  });

  console.log('Streaming response:');

  const stream = client.messages.stream({
    model: settings.model || 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'Write a haiku about coding' }
    ]
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);
    }
  }
  console.log('\n');

  return stream.finalMessage();
}

// =============================================================================
// EXAMPLE 3: Tool Use (Function Calling)
// =============================================================================

async function toolUseExample() {
  const settings = loadUserSettings();

  const client = new Anthropic({
    apiKey: getApiKey(),
    baseURL: settings.env?.ANTHROPIC_BEDROCK_BASE_URL
  });

  // Define tools
  const tools = [
    {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      input_schema: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name, e.g., "San Francisco"'
          }
        },
        required: ['location']
      }
    },
    {
      name: 'get_time',
      description: 'Get the current time for a timezone',
      input_schema: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'Timezone, e.g., "America/New_York"'
          }
        },
        required: ['timezone']
      }
    }
  ];

  const message = await client.messages.create({
    model: settings.model || 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    tools: tools,
    messages: [
      { role: 'user', content: 'What is the weather in Tokyo and what time is it there?' }
    ]
  });

  console.log('Tool calls requested:');
  for (const block of message.content) {
    if (block.type === 'tool_use') {
      console.log(`  - ${block.name}(${JSON.stringify(block.input)})`);
    }
  }

  return message;
}

// =============================================================================
// EXAMPLE 4: Multi-turn Conversation
// =============================================================================

async function conversationExample() {
  const settings = loadUserSettings();

  const client = new Anthropic({
    apiKey: getApiKey(),
    baseURL: settings.env?.ANTHROPIC_BEDROCK_BASE_URL
  });

  const messages = [];

  // Turn 1
  messages.push({ role: 'user', content: 'My name is Alex. Remember that.' });

  let response = await client.messages.create({
    model: settings.model || 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: messages
  });

  messages.push({ role: 'assistant', content: response.content });
  console.log('Turn 1:', response.content[0].text);

  // Turn 2
  messages.push({ role: 'user', content: 'What is my name?' });

  response = await client.messages.create({
    model: settings.model || 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: messages
  });

  console.log('Turn 2:', response.content[0].text);

  return response;
}

// =============================================================================
// EXAMPLE 5: Using Different Models
// =============================================================================

async function differentModelsExample() {
  const settings = loadUserSettings();

  const client = new Anthropic({
    apiKey: getApiKey(),
    baseURL: settings.env?.ANTHROPIC_BEDROCK_BASE_URL
  });

  const models = [
    'claude-sonnet-4-20250514',  // Fast, good for most tasks
    'claude-haiku-3-5-20241022', // Fastest, cheapest
    // 'claude-opus-4-20250514', // Most capable (if available)
  ];

  for (const model of models) {
    console.log(`\nUsing model: ${model}`);
    try {
      const start = Date.now();
      const message = await client.messages.create({
        model: model,
        max_tokens: 256,
        messages: [
          { role: 'user', content: 'Say "Hello" in 3 different languages, briefly.' }
        ]
      });
      const elapsed = Date.now() - start;
      console.log(`  Response (${elapsed}ms): ${message.content[0].text}`);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

// =============================================================================
// RUN EXAMPLES
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const example = args[0] || 'basic';

  console.log('='.repeat(60));
  console.log(`Running example: ${example}`);
  console.log('='.repeat(60));
  console.log();

  try {
    switch (example) {
      case 'basic':
        await basicExample();
        break;
      case 'streaming':
        await streamingExample();
        break;
      case 'tools':
        await toolUseExample();
        break;
      case 'conversation':
        await conversationExample();
        break;
      case 'models':
        await differentModelsExample();
        break;
      case 'all':
        await basicExample();
        console.log('\n' + '-'.repeat(40) + '\n');
        await streamingExample();
        console.log('\n' + '-'.repeat(40) + '\n');
        await toolUseExample();
        console.log('\n' + '-'.repeat(40) + '\n');
        await conversationExample();
        break;
      default:
        console.log('Available examples: basic, streaming, tools, conversation, models, all');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
