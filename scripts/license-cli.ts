#!/usr/bin/env tsx

/**
 * License Management CLI
 * 
 * Command-line tool for managing licenses:
 * - Generate new licenses
 * - Activate licenses
 * - Check license status
 * - Deactivate licenses
 * 
 * Usage:
 *   pnpm tsx scripts/license-cli.ts generate <email> <name> <days>
 *   pnpm tsx scripts/license-cli.ts activate <license-key>
 *   pnpm tsx scripts/license-cli.ts status
 *   pnpm tsx scripts/license-cli.ts deactivate
 * 
 * @author Manus AI
 * @version 2.0.0
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { HardwareID } from '../server/_core/hardware-id';
import { licenseSystem, License } from '../server/_core/license-system';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message: string) {
  log(`❌ ${message}`, 'red');
}

function success(message: string) {
  log(`✅ ${message}`, 'green');
}

function info(message: string) {
  log(`ℹ️  ${message}`, 'cyan');
}

function warning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

/**
 * Generate a new license
 */
async function generateLicense(
  email: string,
  name: string,
  daysValid: number,
  type: 'trial' | 'basic' | 'pro' | 'enterprise' = 'pro'
) {
  log('\n╔════════════════════════════════════════════════════════╗', 'bright');
  log('║            LICENSE GENERATION                          ║', 'bright');
  log('╚════════════════════════════════════════════════════════╝\n', 'bright');
  
  // Get hardware ID
  info('Generating hardware fingerprint...');
  const hardwareId = HardwareID.generate();
  const fingerprint = HardwareID.generateFingerprint();
  
  // Generate license key
  const licenseKey = `DTP-${type.toUpperCase()}-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
  
  // Calculate dates
  const now = Date.now();
  const expiresAt = now + daysValid * 24 * 60 * 60 * 1000;
  
  // Define features based on type
  const features: Record<typeof type, string[]> = {
    trial: ['basic_operations', 'anti_ban'],
    basic: ['basic_operations', 'anti_ban', 'bulk_operations'],
    pro: ['basic_operations', 'anti_ban', 'bulk_operations', 'ml_engine', 'advanced_proxies'],
    enterprise: ['basic_operations', 'anti_ban', 'bulk_operations', 'ml_engine', 'advanced_proxies', 'priority_support', 'custom_features'],
  };
  
  // Define limits based on type
  const limits: Record<typeof type, { maxAccounts: number; maxOperationsPerDay: number }> = {
    trial: { maxAccounts: 10, maxOperationsPerDay: 1000 },
    basic: { maxAccounts: 50, maxOperationsPerDay: 10000 },
    pro: { maxAccounts: 500, maxOperationsPerDay: 100000 },
    enterprise: { maxAccounts: 10000, maxOperationsPerDay: 1000000 },
  };
  
  // Create license object
  const license: License = {
    key: licenseKey,
    type,
    hardwareId,
    issuedAt: now,
    expiresAt,
    features: features[type],
    maxAccounts: limits[type].maxAccounts,
    maxOperationsPerDay: limits[type].maxOperationsPerDay,
    signature: '',
  };
  
  // Sign license
  const encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  const dataToSign = [
    license.key,
    license.type,
    license.hardwareId,
    license.issuedAt,
    license.expiresAt,
    license.features.join(','),
    license.maxAccounts,
    license.maxOperationsPerDay,
  ].join('|');
  
  license.signature = crypto
    .createHmac('sha256', encryptionKey)
    .update(dataToSign)
    .digest('hex');
  
  // Save license to file
  const licenseData = {
    license,
    metadata: {
      email,
      name,
      generatedAt: new Date().toISOString(),
      hardwareFingerprint: fingerprint,
    },
  };
  
  const outputDir = path.join(process.cwd(), 'licenses');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const filename = `license-${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(licenseData, null, 2), 'utf8');
  
  // Display license information
  log('\n╔════════════════════════════════════════════════════════╗', 'green');
  log('║              LICENSE GENERATED SUCCESSFULLY            ║', 'green');
  log('╠════════════════════════════════════════════════════════╣', 'green');
  log(`║ License Key:   ${licenseKey.substring(0, 30)}... ║`, 'green');
  log(`║ Type:          ${type.toUpperCase().padEnd(40)} ║`, 'green');
  log(`║ Email:         ${email.padEnd(40)} ║`, 'green');
  log(`║ Name:          ${name.padEnd(40)} ║`, 'green');
  log(`║ Valid For:     ${daysValid} days${' '.repeat(40 - (daysValid.toString().length + 5))} ║`, 'green');
  log(`║ Expires:       ${new Date(expiresAt).toLocaleDateString().padEnd(40)} ║`, 'green');
  log(`║ Max Accounts:  ${limits[type].maxAccounts.toString().padEnd(40)} ║`, 'green');
  log(`║ Max Ops/Day:   ${limits[type].maxOperationsPerDay.toString().padEnd(40)} ║`, 'green');
  log('╠════════════════════════════════════════════════════════╣', 'green');
  log(`║ Hardware ID:   ${hardwareId.substring(0, 40)} ║`, 'green');
  log('╠════════════════════════════════════════════════════════╣', 'green');
  log(`║ Saved to:      ${filename.padEnd(40)} ║`, 'green');
  log('╚════════════════════════════════════════════════════════╝\n', 'green');
  
  success('License generated successfully!');
  info(`Full license key: ${licenseKey}`);
  info(`License file: ${filepath}`);
  
  log('\n📋 To activate this license, run:', 'cyan');
  log(`   pnpm tsx scripts/license-cli.ts activate ${licenseKey}\n`, 'bright');
}

/**
 * Activate a license
 */
async function activateLicense(licenseKey: string) {
  log('\n╔════════════════════════════════════════════════════════╗', 'bright');
  log('║            LICENSE ACTIVATION                          ║', 'bright');
  log('╚════════════════════════════════════════════════════════╝\n', 'bright');
  
  info('Activating license...');
  
  const result = await licenseSystem.activate(licenseKey);
  
  if (result.success) {
    success('License activated successfully!');
    
    const license = licenseSystem.getLicense();
    if (license) {
      log('\n╔════════════════════════════════════════════════════════╗', 'green');
      log('║              LICENSE INFORMATION                       ║', 'green');
      log('╠════════════════════════════════════════════════════════╣', 'green');
      log(`║ Type:          ${license.type.toUpperCase().padEnd(40)} ║`, 'green');
      log(`║ Max Accounts:  ${license.maxAccounts.toString().padEnd(40)} ║`, 'green');
      log(`║ Max Ops/Day:   ${license.maxOperationsPerDay.toString().padEnd(40)} ║`, 'green');
      log(`║ Expires:       ${new Date(license.expiresAt).toLocaleDateString().padEnd(40)} ║`, 'green');
      log('╠════════════════════════════════════════════════════════╣', 'green');
      log('║ Features:                                              ║', 'green');
      license.features.forEach(feature => {
        log(`║   • ${feature.padEnd(48)} ║`, 'green');
      });
      log('╚════════════════════════════════════════════════════════╝\n', 'green');
    }
  } else {
    error(`License activation failed: ${result.message}`);
    process.exit(1);
  }
}

/**
 * Check license status
 */
async function checkStatus() {
  log('\n╔════════════════════════════════════════════════════════╗', 'bright');
  log('║            LICENSE STATUS                              ║', 'bright');
  log('╚════════════════════════════════════════════════════════╝\n', 'bright');
  
  const initialized = await licenseSystem.initialize();
  
  if (!initialized) {
    warning('No active license found');
    info('To activate a license, run:');
    log('   pnpm tsx scripts/license-cli.ts activate <LICENSE_KEY>\n', 'bright');
    return;
  }
  
  const license = licenseSystem.getLicense();
  const isValid = licenseSystem.isValid();
  
  if (!license) {
    error('License data not available');
    return;
  }
  
  const statusColor = isValid ? 'green' : 'red';
  const statusText = isValid ? 'VALID' : 'INVALID';
  
  log(`\n╔════════════════════════════════════════════════════════╗`, statusColor);
  log(`║ Status:        ${statusText.padEnd(40)} ║`, statusColor);
  log(`╠════════════════════════════════════════════════════════╣`, statusColor);
  log(`║ Type:          ${license.type.toUpperCase().padEnd(40)} ║`, statusColor);
  log(`║ Max Accounts:  ${license.maxAccounts.toString().padEnd(40)} ║`, statusColor);
  log(`║ Max Ops/Day:   ${license.maxOperationsPerDay.toString().padEnd(40)} ║`, statusColor);
  log(`║ Issued:        ${new Date(license.issuedAt).toLocaleDateString().padEnd(40)} ║`, statusColor);
  log(`║ Expires:       ${new Date(license.expiresAt).toLocaleDateString().padEnd(40)} ║`, statusColor);
  log(`╠════════════════════════════════════════════════════════╣`, statusColor);
  log(`║ Features:                                              ║`, statusColor);
  license.features.forEach(feature => {
    log(`║   • ${feature.padEnd(48)} ║`, statusColor);
  });
  log(`╚════════════════════════════════════════════════════════╝\n`, statusColor);
  
  // Calculate days remaining
  const daysRemaining = Math.ceil((license.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
  
  if (daysRemaining > 30) {
    success(`License is valid for ${daysRemaining} more days`);
  } else if (daysRemaining > 7) {
    warning(`License expires in ${daysRemaining} days`);
  } else if (daysRemaining > 0) {
    error(`License expires in ${daysRemaining} days - please renew soon!`);
  } else {
    error('License has expired!');
  }
}

/**
 * Deactivate license
 */
async function deactivateLicense() {
  log('\n╔════════════════════════════════════════════════════════╗', 'bright');
  log('║            LICENSE DEACTIVATION                        ║', 'bright');
  log('╚════════════════════════════════════════════════════════╝\n', 'bright');
  
  warning('This will deactivate the current license.');
  info('Deactivating...');
  
  await licenseSystem.deactivate();
  
  success('License deactivated successfully!');
}

/**
 * Display hardware ID
 */
function displayHardwareId() {
  log('\n╔════════════════════════════════════════════════════════╗', 'bright');
  log('║            HARDWARE INFORMATION                        ║', 'bright');
  log('╚════════════════════════════════════════════════════════╝\n', 'bright');
  
  const hardwareId = HardwareID.generate();
  const fingerprint = HardwareID.generateFingerprint();
  
  log(`\n╔════════════════════════════════════════════════════════╗`, 'cyan');
  log(`║ Hardware ID:                                           ║`, 'cyan');
  log(`║ ${hardwareId.substring(0, 52)} ║`, 'cyan');
  log(`║ ${hardwareId.substring(52).padEnd(52)} ║`, 'cyan');
  log(`╠════════════════════════════════════════════════════════╣`, 'cyan');
  log(`║ CPU Model:     ${fingerprint.components.cpuModel.substring(0, 38).padEnd(38)} ║`, 'cyan');
  log(`║ CPU Cores:     ${fingerprint.components.cpuCores.toString().padEnd(38)} ║`, 'cyan');
  log(`║ Total Memory:  ${Math.round(fingerprint.components.totalMemory / 1024 / 1024 / 1024).toString().padEnd(38)} GB ║`, 'cyan');
  log(`║ MAC Address:   ${fingerprint.components.macAddress.padEnd(38)} ║`, 'cyan');
  log(`║ Hostname:      ${fingerprint.components.hostname.padEnd(38)} ║`, 'cyan');
  log(`║ Platform:      ${fingerprint.components.platform.padEnd(38)} ║`, 'cyan');
  log(`║ Architecture:  ${fingerprint.components.arch.padEnd(38)} ║`, 'cyan');
  log(`╚════════════════════════════════════════════════════════╝\n`, 'cyan');
  
  info('Use this Hardware ID when requesting a license');
}

/**
 * Display usage
 */
function displayUsage() {
  log('\n╔════════════════════════════════════════════════════════╗', 'bright');
  log('║        FALKON PRO Telegram Pro - License CLI               ║', 'bright');
  log('╚════════════════════════════════════════════════════════╝\n', 'bright');
  
  log('Usage:', 'cyan');
  log('  pnpm tsx scripts/license-cli.ts <command> [options]\n', 'bright');
  
  log('Commands:', 'cyan');
  log('  generate <email> <name> <days> [type]  Generate a new license', 'bright');
  log('  activate <license-key>                 Activate a license', 'bright');
  log('  status                                 Check license status', 'bright');
  log('  deactivate                             Deactivate current license', 'bright');
  log('  hardware                               Display hardware ID', 'bright');
  log('  help                                   Display this help\n', 'bright');
  
  log('Examples:', 'cyan');
  log('  pnpm tsx scripts/license-cli.ts generate user@example.com "John Doe" 365 pro', 'bright');
  log('  pnpm tsx scripts/license-cli.ts activate DTP-PRO-XXXXXXXXXXXX', 'bright');
  log('  pnpm tsx scripts/license-cli.ts status', 'bright');
  log('  pnpm tsx scripts/license-cli.ts hardware\n', 'bright');
}

/**
 * Main CLI function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'help') {
    displayUsage();
    return;
  }
  
  try {
    switch (command) {
      case 'generate':
        const email = args[1];
        const name = args[2];
        const days = parseInt(args[3]);
        const type = (args[4] as any) || 'pro';
        
        if (!email || !name || !days) {
          error('Missing required arguments');
          log('Usage: pnpm tsx scripts/license-cli.ts generate <email> <name> <days> [type]\n');
          process.exit(1);
        }
        
        await generateLicense(email, name, days, type);
        break;
      
      case 'activate':
        const licenseKey = args[1];
        
        if (!licenseKey) {
          error('Missing license key');
          log('Usage: pnpm tsx scripts/license-cli.ts activate <license-key>\n');
          process.exit(1);
        }
        
        await activateLicense(licenseKey);
        break;
      
      case 'status':
        await checkStatus();
        break;
      
      case 'deactivate':
        await deactivateLicense();
        break;
      
      case 'hardware':
        displayHardwareId();
        break;
      
      default:
        error(`Unknown command: ${command}`);
        displayUsage();
        process.exit(1);
    }
  } catch (error: any) {
    error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run CLI
main();

