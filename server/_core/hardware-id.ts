/**
 * Hardware ID System - Advanced Device Fingerprinting
 * 
 * Creates a unique, tamper-resistant identifier for each device.
 * Combines multiple hardware characteristics to prevent spoofing.
 * 
 * @module HardwareID
 * @author Manus AI
 * @version 2.0.0
 */

import { machineIdSync } from 'node-machine-id';
import * as os from 'os';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface HardwareFingerprint {
  id: string;
  components: {
    machineId: string;
    cpuModel: string;
    cpuCores: number;
    totalMemory: number;
    macAddress: string;
    hostname: string;
    platform: string;
    arch: string;
  };
  timestamp: number;
  signature: string;
}

export class HardwareID {
  private static readonly SALT = 'dragon-telegram-pro-v2-secure';
  private static cachedId: string | null = null;

  static getInstance(): HardwareID {
    return new HardwareID();
  }

  /**
   * Generate a unique hardware ID for this device
   * Combines multiple hardware characteristics for maximum uniqueness
   */
  generateSync(): string {
    if (HardwareID.cachedId) {
      return HardwareID.cachedId;
    }

    try {
      // 1. Machine ID (most reliable)
      const machineId = machineIdSync(true);

      // 2. CPU Information
      const cpus = os.cpus();
      const cpuModel = cpus[0]?.model || 'unknown';
      const cpuCores = cpus.length;

      // 3. Memory (total RAM)
      const totalMemory = os.totalmem();

      // 4. Network Interface (MAC address)
      const networkInterfaces = os.networkInterfaces();
      const macAddress = HardwareID.extractMacAddress(networkInterfaces);

      // 5. Hostname
      const hostname = os.hostname();

      // 6. Platform and Architecture
      const platform = os.platform();
      const arch = os.arch();

      // 7. Disk Serial (if available)
      const diskSerial = HardwareID.getDiskSerial();

      // Combine all components
      const components = [
        machineId,
        cpuModel,
        cpuCores.toString(),
        totalMemory.toString(),
        macAddress,
        hostname,
        platform,
        arch,
        diskSerial,
        HardwareID.SALT,
      ].join('|');

      // Create SHA-256 hash
      const hash = crypto
        .createHash('sha256')
        .update(components)
        .digest('hex');

      // Format: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
      const formatted = hash.match(/.{1,4}/g)?.join('-') || hash;

      HardwareID.cachedId = formatted;
      return formatted;

    } catch (error) {
      console.error('[HardwareID] Error generating ID:', error);
      // Fallback to basic machine ID
      return machineIdSync(true);
    }
  }

  static generate(): string {
    return HardwareID.getInstance().generateSync();
  }

  /**
   * Generate detailed fingerprint with all components
   */
  static generateFingerprint(): HardwareFingerprint {
    const machineId = machineIdSync(true);
    const cpus = os.cpus();
    const networkInterfaces = os.networkInterfaces();

    const components = {
      machineId,
      cpuModel: cpus[0]?.model || 'unknown',
      cpuCores: cpus.length,
      totalMemory: os.totalmem(),
      macAddress: this.extractMacAddress(networkInterfaces),
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
    };

    const id = this.generate();
    const timestamp = Date.now();

    // Create signature
    const dataToSign = JSON.stringify({ id, components, timestamp });
    const signature = crypto
      .createHmac('sha256', this.SALT)
      .update(dataToSign)
      .digest('hex');

    return {
      id,
      components,
      timestamp,
      signature,
    };
  }

  /**
   * Verify if the stored hardware ID matches current device
   */
  static verify(storedId: string): boolean {
    try {
      const currentId = this.generate();

      // Use timing-safe comparison to prevent timing attacks
      const storedBuffer = Buffer.from(storedId);
      const currentBuffer = Buffer.from(currentId);

      if (storedBuffer.length !== currentBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(storedBuffer, currentBuffer);

    } catch (error) {
      console.error('[HardwareID] Verification error:', error);
      return false;
    }
  }

  /**
   * Verify fingerprint signature
   */
  static verifyFingerprint(fingerprint: HardwareFingerprint): boolean {
    try {
      const { id, components, timestamp, signature } = fingerprint;

      // Recreate signature
      const dataToSign = JSON.stringify({ id, components, timestamp });
      const expectedSignature = crypto
        .createHmac('sha256', this.SALT)
        .update(dataToSign)
        .digest('hex');

      // Timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

    } catch (error) {
      console.error('[HardwareID] Fingerprint verification error:', error);
      return false;
    }
  }

  /**
   * Check if hardware has changed significantly
   * Returns similarity score (0-1)
   */
  static compareFingerprints(
    fp1: HardwareFingerprint,
    fp2: HardwareFingerprint
  ): number {
    let matches = 0;
    let total = 0;

    // Compare each component
    const keys = Object.keys(fp1.components) as Array<keyof typeof fp1.components>;

    for (const key of keys) {
      total++;
      if (fp1.components[key] === fp2.components[key]) {
        matches++;
      }
    }

    return matches / total;
  }

  /**
   * Extract MAC address from network interfaces
   */
  private static extractMacAddress(
    interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>
  ): string {
    // Priority: Ethernet > WiFi > Other
    const priorities = ['eth', 'en', 'wlan', 'wi'];

    for (const priority of priorities) {
      for (const [name, infos] of Object.entries(interfaces)) {
        if (name.toLowerCase().startsWith(priority)) {
          const info = infos?.find(
            (i) => i.mac && i.mac !== '00:00:00:00:00:00'
          );
          if (info) {
            return info.mac;
          }
        }
      }
    }

    // Fallback: any non-zero MAC
    for (const infos of Object.values(interfaces)) {
      const info = infos?.find(
        (i) => i.mac && i.mac !== '00:00:00:00:00:00'
      );
      if (info) {
        return info.mac;
      }
    }

    return 'unknown';
  }

  /**
   * Get disk serial number (platform-specific)
   */
  private static getDiskSerial(): string {
    try {
      const platform = os.platform();

      if (platform === 'linux') {
        // Try to read from /sys/class/dmi/id/product_uuid
        const uuidPath = '/sys/class/dmi/id/product_uuid';
        if (fs.existsSync(uuidPath)) {
          return fs.readFileSync(uuidPath, 'utf8').trim();
        }
      } else if (platform === 'darwin') {
        // macOS: Use IOPlatformUUID
        // This would require child_process.execSync('ioreg -rd1 -c IOPlatformExpertDevice')
        // For now, skip to avoid complexity
      } else if (platform === 'win32') {
        // Windows: Use WMIC
        // This would require child_process.execSync('wmic csproduct get uuid')
        // For now, skip to avoid complexity
      }

    } catch (error) {
      // Ignore errors, disk serial is optional
    }

    return 'unknown';
  }

  /**
   * Save hardware ID to file (encrypted)
   */
  static async saveToFile(filePath: string, encryptionKey: string): Promise<void> {
    const fingerprint = this.generateFingerprint();
    const data = JSON.stringify(fingerprint);

    // Encrypt data
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(encryptionKey, 'hex'),
      iv
    );

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    const payload = JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted,
      tag: authTag.toString('hex'),
    });

    fs.writeFileSync(filePath, payload, 'utf8');
  }

  /**
   * Load and verify hardware ID from file
   */
  static async loadFromFile(
    filePath: string,
    encryptionKey: string
  ): Promise<HardwareFingerprint | null> {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const { iv, data, tag } = payload;

      // Decrypt data
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(encryptionKey, 'hex'),
        Buffer.from(iv, 'hex')
      );

      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const fingerprint = JSON.parse(decrypted) as HardwareFingerprint;

      // Verify signature
      if (!this.verifyFingerprint(fingerprint)) {
        console.error('[HardwareID] Invalid fingerprint signature');
        return null;
      }

      return fingerprint;

    } catch (error) {
      console.error('[HardwareID] Error loading from file:', error);
      return null;
    }
  }

  /**
   * Clear cached ID (for testing)
   */
  static clearCache(): void {
    HardwareID.cachedId = null;
  }
}

export const hardwareId = HardwareID.getInstance();
