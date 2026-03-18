#!/usr/bin/env node

// Generate secure random keys for production
const crypto = require('crypto');

function generateRandomHex(length) {
  return crypto.randomBytes(length).toString('hex');
}

console.log('=== Dragon Telegram Pro - Secure Keys Generator ===\n');

console.log('🔐 ENCRYPTION_KEY:');
console.log(generateRandomHex(32));

console.log('\n🔑 JWT_SECRET:');
console.log(generateRandomHex(32));

console.log('\n🔒 SESSION_SECRET:');
console.log(generateRandomHex(32));

console.log('\n📝 Copy these keys to your .env file');
console.log('⚠️  Keep these keys secure and never commit them to version control');
