/**
 * Claude Agent SDK Example with Company (LaunchCode/Bedrock) Configuration
 *
 * This uses the @anthropic-ai/claude-agent-sdk for agentic workflows
 * with file reading, editing, bash commands, and subagents.
 *
 * Install first: npm install @anthropic-ai/claude-agent-sdk
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONFIGURATION
// =============================================================================

// Get API key from company's helper script or env
function getApiKey() {
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }

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
// EXAMPLE 1: Basic Query with User Settings
// =============================================================================

async function basicAgentExample() {
  console.log('Running basic agent query...\n');

  for await (const message of query({
    prompt: 'List the JavaScript files in this project and summarize what each one does.',
    options: {
      // Load your company's settings from ~/.claude/settings.json
      settingSources: ['user'],

      // Set working directory to DhuBot project
      cwd: path.join(__dirname, '..'),

      // Only allow read operations (safe)
      allowedTools: ['Read', 'Glob', 'Grep'],

      // Use Claude Code's system prompt
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code'
      }
    }
  })) {
    // Log progress
    if (message.type === 'assistant') {
      for (const block of message.content) {
        if (block.type === 'text') {
          process.stdout.write(block.text);
        }
      }
    }

    // Final result
    if (message.type === 'result' && message.subtype === 'success') {
      console.log('\n\n--- Final Result ---');
      console.log(message.result);
      console.log(`Cost: $${message.total_cost_usd?.toFixed(4) || 'N/A'}`);
    }
  }
}

// =============================================================================
// EXAMPLE 2: Agent with Custom Subagents
// =============================================================================

async function subagentExample() {
  console.log('Running subagent example...\n');

  for await (const message of query({
    prompt: 'Use the code-analyzer to examine the harvest.js file and identify any potential improvements.',
    options: {
      settingSources: ['user'],
      cwd: path.join(__dirname, '..'),

      // Task tool required for subagents
      allowedTools: ['Read', 'Glob', 'Grep', 'Task'],

      // Define custom subagents
      agents: {
        'code-analyzer': {
          description: 'Analyzes code for patterns, issues, and improvements',
          prompt: `You are a code analysis expert. When analyzing code:
- Identify potential bugs or issues
- Suggest performance improvements
- Note any security concerns
- Recommend best practices
Be concise and actionable.`,
          tools: ['Read', 'Grep', 'Glob'],
          model: 'sonnet' // Use faster model for analysis
        },
        'test-suggester': {
          description: 'Suggests test cases for code',
          prompt: `You are a testing expert. Suggest comprehensive test cases including:
- Unit tests
- Edge cases
- Error handling tests
Be specific about what to test.`,
          tools: ['Read', 'Grep'],
          model: 'haiku' // Use fastest model
        }
      }
    }
  })) {
    if (message.type === 'result' && message.subtype === 'success') {
      console.log('--- Result ---');
      console.log(message.result);
    }
  }
}

// =============================================================================
// EXAMPLE 3: Code Search and Analysis
// =============================================================================

async function codeSearchExample() {
  console.log('Running code search example...\n');

  for await (const message of query({
    prompt: 'Find all Slack-related functions in this project and explain how the Slack integration works.',
    options: {
      settingSources: ['user'],
      cwd: path.join(__dirname, '..'),
      allowedTools: ['Read', 'Glob', 'Grep'],
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code'
      }
    }
  })) {
    if (message.type === 'result' && message.subtype === 'success') {
      console.log(message.result);
    }
  }
}

// =============================================================================
// EXAMPLE 4: With Explicit Environment Variables
// =============================================================================

async function explicitEnvExample() {
  console.log('Running with explicit env vars...\n');

  for await (const message of query({
    prompt: 'What model are you using and what capabilities do you have?',
    options: {
      // Explicit configuration (overrides settings files)
      env: {
        CLAUDE_CODE_USE_BEDROCK: '1',
        ANTHROPIC_BEDROCK_BASE_URL: 'https://rocketpartners.launch-code.dev/api/gateway/bedrock',
        CLAUDE_CODE_SKIP_BEDROCK_AUTH: '1',
        AWS_REGION: 'us-east-1',
        ANTHROPIC_API_KEY: getApiKey()
      },

      cwd: path.join(__dirname, '..'),
      allowedTools: ['Read'],

      systemPrompt: {
        type: 'preset',
        preset: 'claude_code'
      }
    }
  })) {
    if (message.type === 'result' && message.subtype === 'success') {
      console.log(message.result);
    }
  }
}

// =============================================================================
// RUN
// =============================================================================

async function main() {
  const example = process.argv[2] || 'basic';

  console.log('='.repeat(60));
  console.log(`Claude Agent SDK Example: ${example}`);
  console.log('='.repeat(60));
  console.log();

  try {
    switch (example) {
      case 'basic':
        await basicAgentExample();
        break;
      case 'subagents':
        await subagentExample();
        break;
      case 'search':
        await codeSearchExample();
        break;
      case 'env':
        await explicitEnvExample();
        break;
      default:
        console.log('Available examples: basic, subagents, search, env');
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('claude-agent-sdk')) {
      console.log('\nInstall the Agent SDK first:');
      console.log('  npm install @anthropic-ai/claude-agent-sdk');
    }
    process.exit(1);
  }
}

main();
