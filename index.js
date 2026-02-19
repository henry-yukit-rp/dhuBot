const { App } = require('@slack/bolt');
require('dotenv').config();

const { migrateToEncrypted } = require('./utils/config');

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// Register command handlers
require('./handlers/commands/reimburse').register(app);
require('./handlers/commands/configure').register(app);
require('./handlers/commands/reimburse-quick').register(app);
require('./handlers/commands/reimbursement-status').register(app);

// Register view handlers
require('./handlers/views/reimburse').register(app);
require('./handlers/views/configure').register(app);

// Register action handlers
require('./handlers/actions/reimburse').register(app);

// Register event handlers
require('./handlers/events/file-shared').register(app);

// Start the app
(async () => {
  // Migrate any existing plain-text credentials to encrypted
  try {
    migrateToEncrypted();
  } catch (err) {
    console.error('Migration error (is ENCRYPTION_KEY set?):', err.message);
  }

  await app.start();
  console.log('Slack bot is running!');
})();
