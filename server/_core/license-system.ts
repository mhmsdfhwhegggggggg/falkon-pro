/**
 * Advanced License System - Complete Protection
 * 
 * Multi-layered license verification system with:
 * - Hardware ID binding
 * - Remote license server validation
 * - Periodic heartbeat checks
 * - Automatic deactivation on tampering
 * - Feature-based licensing
 * 
 * @module LicenseSystem
 * @author Manus AI
 * @version 2.0.0
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosInstance } from 'axios';
import { HardwareID, HardwareFingerprint } from './hardware-id';

export interface License {
  key: string;
  type: 'trial' | 'basic' | 'pro' | 'enterprise';
  hardwareId: string;
  issuedAt: number;
  expiresAt: number;
  features: string[];
  maxAccounts: number;
  maxOperationsPerDay: number;
  signature: string;
}

export interface LicenseValidationResponse {
  valid: boolean;
  license?: License;
  token?: string;  // JWT token for subsequent requests
  reason?: string;
  expiresAt?: number;
}

export interface HeartbeatData {
  activeAccounts: number;
  operationsToday: number;
  lastOperation: number;
  systemHealth: 'healthy' | 'degraded' | 'unhealthy';
}

export class LicenseSystem {
  private static instance: LicenseSystem;
  private license: License | null = null;
  private token: string | null = null;
  private licenseFilePath: string;
  private encryptionKey: string;
  private licenseServerUrl: string;
  private httpClient: AxiosInstance;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private failedHeartbeats: number = 0;
  private readonly MAX_FAILED_HEARTBEATS = 3;
  private readonly HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.licenseFilePath = path.join(process.cwd(), '.license');
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateKey();
    this.licenseServerUrl = process.env.LICENSE_SERVER_URL || 'https://license.dragon-telegram.pro';

    this.httpClient = axios.create({
      baseURL: this.licenseServerUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dragon-Telegram-Pro/2.0.0',
      },
    });
  }

  static getInstance(): LicenseSystem {
    if (!this.instance) {
      this.instance = new LicenseSystem();
    }
    return this.instance;
  }

  /**
   * Initialize license system
   * Must be called at application startup
   */
  async initialize(): Promise<boolean> {
    console.log('[License] Initializing license system...');

    try {
      // 1. Load license from file
      const license = await this.loadLicense();
      if (!license) {
        console.error('[License] No license file found');
        return false;
      }

      // 2. Verify hardware ID
      if (!HardwareID.verify(license.hardwareId)) {
        console.error('[License] Hardware ID mismatch - license bound to different device');
        return false;
      }

      // 3. Verify signature
      if (!this.verifySignature(license)) {
        console.error('[License] Invalid license signature - possible tampering');
        return false;
      }

      // 4. Check expiration
      if (Date.now() > license.expiresAt) {
        console.error('[License] License expired');
        return false;
      }

      // 5. Validate with license server
      const validation = await this.validateWithServer(license);
      if (!validation.valid) {
        console.error('[License] Server validation failed:', validation.reason);
        return false;
      }

      // 6. Store license and token
      this.license = license;
      this.token = validation.token || null;

      // 7. Start heartbeat
      this.startHeartbeat();

      console.log('[License] ✅ License validated successfully');
      console.log('[License] Type:', license.type);
      console.log('[License] Features:', license.features.join(', '));
      console.log('[License] Max Accounts:', license.maxAccounts);
      console.log('[License] Expires:', new Date(license.expiresAt).toISOString());

      return true;

    } catch (error: any) {
      console.error('[License] Initialization error:', error.message);
      return false;
    }
  }

  /**
   * Validate license with remote server
   */
  private async validateWithServer(license: License): Promise<LicenseValidationResponse> {
    try {
      const fingerprint = HardwareID.generateFingerprint();
      const appChecksum = await this.calculateAppChecksum();

      const response = await this.httpClient.post<LicenseValidationResponse>(
        '/api/v1/license/validate',
        {
          licenseKey: license.key,
          hardwareId: license.hardwareId,
          fingerprint,
          appVersion: '2.0.0',
          appChecksum,
          timestamp: Date.now(),
        }
      );

      return response.data;

    } catch (error: any) {
      if (error.response) {
        return {
          valid: false,
          reason: error.response.data?.message || 'Server validation failed',
        };
      }

      // If server is unreachable, allow offline validation for 24 hours
      if (this.license && Date.now() - this.license.issuedAt < 24 * 60 * 60 * 1000) {
        console.warn('[License] Server unreachable, using offline validation');
        return { valid: true };
      }

      return {
        valid: false,
        reason: 'Cannot reach license server',
      };
    }
  }

  /**
   * Send heartbeat to license server
   */
  private async sendHeartbeat(): Promise<boolean> {
    if (!this.license || !this.token) {
      return false;
    }

    try {
      const heartbeatData: HeartbeatData = {
        activeAccounts: await this.getActiveAccountsCount(),
        operationsToday: await this.getOperationsCount(),
        lastOperation: Date.now(),
        systemHealth: 'healthy',
      };

      const response = await this.httpClient.post(
        '/api/v1/license/heartbeat',
        heartbeatData,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
        }
      );

      if (response.data.valid === false) {
        console.error('[License] Heartbeat failed: license revoked');
        return false;
      }

      // Reset failure counter
      this.failedHeartbeats = 0;
      return true;

    } catch (error: any) {
      console.error('[License] Heartbeat error:', error.message);
      this.failedHeartbeats++;

      if (this.failedHeartbeats >= this.MAX_FAILED_HEARTBEATS) {
        console.error('[License] Too many failed heartbeats, shutting down...');
        this.shutdown();
        return false;
      }

      return false;
    }
  }

  /**
   * Start periodic heartbeat
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Send initial heartbeat
    this.sendHeartbeat();

    // Schedule periodic heartbeats
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL_MS) as any;
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Check if a feature is enabled
   */
  hasFeature(feature: string): boolean {
    return this.license?.features.includes(feature) || false;
  }

  /**
   * Get license information
   */
  getLicense(): License | null {
    return this.license;
  }

  /**
   * Check if license is valid
   */
  isValid(): boolean {
    if (!this.license) {
      return false;
    }

    // Check expiration
    if (Date.now() > this.license.expiresAt) {
      return false;
    }

    // Check hardware ID
    if (!HardwareID.verify(this.license.hardwareId)) {
      return false;
    }

    return true;
  }

  /**
   * Activate license with key
   */
  async activate(licenseKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const hardwareId = HardwareID.generate();
      const fingerprint = HardwareID.generateFingerprint();

      const response = await this.httpClient.post('/api/v1/license/activate', {
        licenseKey,
        hardwareId,
        fingerprint,
        appVersion: '2.0.0',
      });

      if (response.data.success) {
        const license: License = response.data.license;

        // Save license to file
        await this.saveLicense(license);

        // Initialize
        await this.initialize();

        return {
          success: true,
          message: 'License activated successfully',
        };
      }

      return {
        success: false,
        message: response.data.message || 'Activation failed',
      };

    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Deactivate license
   */
  async deactivate(): Promise<void> {
    if (!this.license || !this.token) {
      return;
    }

    try {
      await this.httpClient.post(
        '/api/v1/license/deactivate',
        { licenseKey: this.license.key },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
        }
      );
    } catch (error) {
      console.error('[License] Deactivation error:', error);
    }

    // Clear local data
    this.stopHeartbeat();
    this.license = null;
    this.token = null;

    // Delete license file
    if (fs.existsSync(this.licenseFilePath)) {
      fs.unlinkSync(this.licenseFilePath);
    }
  }

  /**
   * Load license from encrypted file
   */
  private async loadLicense(): Promise<License | null> {
    try {
      if (!fs.existsSync(this.licenseFilePath)) {
        return null;
      }

      const encrypted = fs.readFileSync(this.licenseFilePath, 'utf8');
      const { iv, data, tag } = JSON.parse(encrypted);

      // Decrypt
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(this.encryptionKey, 'hex'),
        Buffer.from(iv, 'hex')
      );

      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted) as License;

    } catch (error) {
      console.error('[License] Error loading license:', error);
      return null;
    }
  }

  /**
   * Save license to encrypted file
   */
  private async saveLicense(license: License): Promise<void> {
    const data = JSON.stringify(license);

    // Encrypt
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(this.encryptionKey, 'hex'),
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

    fs.writeFileSync(this.licenseFilePath, payload, 'utf8');
  }

  /**
   * Verify license signature
   */
  private verifySignature(license: License): boolean {
    try {
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

      // In production, use RSA public key verification
      // For now, use HMAC
      const expectedSignature = crypto
        .createHmac('sha256', this.encryptionKey)
        .update(dataToSign)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(license.signature),
        Buffer.from(expectedSignature)
      );

    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate application checksum (for integrity verification)
   */
  private async calculateAppChecksum(): Promise<string> {
    try {
      // In production, calculate checksums of all critical files
      // For now, return a placeholder
      const criticalFiles = [
        'server/_core/index.js',
        'server/_core/license-system.js',
        'server/_core/hardware-id.js',
      ];

      const checksums: string[] = [];

      for (const file of criticalFiles) {
        const filePath = path.join(process.cwd(), 'dist', file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath);
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          checksums.push(hash);
        }
      }

      return crypto
        .createHash('sha256')
        .update(checksums.join('|'))
        .digest('hex');

    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Generate encryption key
   */
  private generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get active accounts count (implement based on your DB)
   */
  private async getActiveAccountsCount(): Promise<number> {
    try {
      const { getActiveAccountsCount } = await import("../db");
      return await getActiveAccountsCount();
    } catch (error) {
      console.error('[License] Failed to get active accounts count:', error);
      return 0;
    }
  }

  /**
   * Get operations count for today (implement based on your DB)
   */
  private async getOperationsCount(): Promise<number> {
    try {
      const { getOperationsCountToday } = await import("../db");
      return await getOperationsCountToday();
    } catch (error) {
      console.error('[License] Failed to get operations count:', error);
      return 0;
    }
  }

  /**
   * Graceful shutdown on license failure
   */
  private shutdown(): void {
    console.error('[License] ⛔ License validation failed - shutting down application');

    this.stopHeartbeat();

    // Give time for cleanup
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  }

  /**
   * Create a trial license (for testing)
   */
  static createTrialLicense(): License {
    const hardwareId = HardwareID.generate();
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    const license: License = {
      key: `TRIAL-${crypto.randomBytes(16).toString('hex').toUpperCase()}`,
      type: 'trial',
      hardwareId,
      issuedAt: now,
      expiresAt,
      features: ['basic_operations', 'anti_ban'],
      maxAccounts: 10,
      maxOperationsPerDay: 1000,
      signature: '',
    };

    // Sign license
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
      .createHmac('sha256', process.env.ENCRYPTION_KEY || 'default-key')
      .update(dataToSign)
      .digest('hex');

    return license;
  }
}

// Export singleton instance
export const licenseSystem = LicenseSystem.getInstance();
