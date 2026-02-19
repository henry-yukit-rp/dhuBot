const crypto = require('crypto');
require("dotenv").config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Get encryption key from environment (must be 32 bytes for AES-256)
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY not found in environment variables');
  }
  // Hash the key to ensure it's exactly 32 bytes
  return crypto.createHash('sha256').update(key).digest();
}

// Encrypt a string
function encrypt(text) {
  if (!text) return text;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: algorithm:iv:authTag:encryptedData
  return `aes256gcm:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

// Decrypt a string
function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;

  // Check if it's encrypted (has our prefix)
  if (!encryptedText.startsWith('aes256gcm:')) {
    // Return as-is if not encrypted (for backwards compatibility)
    return encryptedText;
  }

  const key = getEncryptionKey();
  const parts = encryptedText.split(':');

  if (parts.length !== 4) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(parts[1], 'hex');
  const authTag = Buffer.from(parts[2], 'hex');
  const encrypted = parts[3];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Check if a string is encrypted
function isEncrypted(text) {
  return text && text.startsWith('aes256gcm:');
}

// Generate a random encryption key (for initial setup)
function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
  generateKey
};
