const fs = require('fs');
const path = require('path');
const { encrypt, decrypt, isEncrypted } = require('./crypto');

const CONFIG_FILE = path.join(__dirname, '..', 'harvest-config.json');

// Load existing config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf8').trim();
      if (!content) return {};
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
  return {};
}

// Save config
function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Get user's Harvest config (decrypted)
function getUserConfig(userId) {
  const config = loadConfig();
  const userConfig = config[userId];

  if (!userConfig) return null;

  try {
    return {
      apiToken: decrypt(userConfig.apiToken),
      accountId: decrypt(userConfig.accountId),
      updatedAt: userConfig.updatedAt
    };
  } catch (err) {
    console.error('Error decrypting user config:', err);
    return null;
  }
}

// Save user's Harvest config (encrypted)
function saveUserConfig(userId, apiToken, accountId) {
  const config = loadConfig();

  config[userId] = {
    apiToken: encrypt(apiToken),
    accountId: encrypt(accountId),
    updatedAt: new Date().toISOString()
  };

  saveConfig(config);
}

// Migrate existing plain-text config to encrypted (run once)
function migrateToEncrypted() {
  const config = loadConfig();
  let migrated = false;

  for (const userId in config) {
    const userConfig = config[userId];

    if (userConfig.apiToken && !isEncrypted(userConfig.apiToken)) {
      config[userId].apiToken = encrypt(userConfig.apiToken);
      migrated = true;
    }

    if (userConfig.accountId && !isEncrypted(userConfig.accountId)) {
      config[userId].accountId = encrypt(userConfig.accountId);
      migrated = true;
    }
  }

  if (migrated) {
    saveConfig(config);
    console.log('Config migrated to encrypted format');
  }

  return migrated;
}

module.exports = {
  loadConfig,
  saveConfig,
  getUserConfig,
  saveUserConfig,
  migrateToEncrypted
};
