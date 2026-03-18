/**
 * License System v3.0 🔥
 * 
 * Advanced license management with:
 * - Hardware ID Binding v3.0
 * - Remote License Server v3.0
 * - Real-time Validation (every 5 minutes)
 * - Kill Switch - immediate remote shutdown ⛔
 * - Blacklist System ⚫
 * - Usage Tracking & Analytics
 * - Developer Dashboard API
 * 
 * @version 3.0.0
 * @author Dragon Team
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosInstance } from 'axios';
import { logger } from '../_core/logger';
import { CacheSystem } from '../_core/cache-system';
import { HardwareID } from './hardware-id';

export interface LicenseV3 {
  id: string;
  key: string;
  type: 'trial' | 'basic' | 'premium' | 'enterprise' | 'lifetime';
  hardwareId: string;
  hardwareFingerprint: string;
  issuedAt: number;
  expiresAt: number;
  features: LicenseFeature[];
  limits: LicenseLimits;
  signature: string;
  checksum: string;
  isActive: boolean;
  lastValidated: number;
  usage: LicenseUsage;
}

export interface LicenseFeature {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  limits?: FeatureLimits;
}

export interface LicenseLimits {
  maxAccounts: number;
  maxOperationsPerDay: number;
  maxExtractionsPerHour: number;
  maxMessagesPerHour: number;
  maxChannels: number;
  maxAutoReplyRules: number;
  maxConcurrentOperations: number;
}

export interface FeatureLimits {
  daily?: number;
  hourly?: number;
  monthly?: number;
  total?: number;
}

export interface LicenseUsage {
  accountsCreated: number;
  operationsToday: number;
  extractionsThisHour: number;
  messagesThisHour: number;
  channelsCreated: number;
  autoReplyRules: number;
  concurrentOperations: number;
  lastReset: number;
}

export interface LicenseValidationResponse {
  valid: boolean;
  license?: LicenseV3;
  token?: string;
  reason?: string;
  action?: 'continue' | 'shutdown' | 'warning' | 'deactivate';
  expiresAt?: number;
  gracePeriod?: number;
}

export interface HardwareFingerprint {
  cpuId: string;
  macAddresses: string[];
  diskSerial: string;
  motherboardSerial: string;
  systemUuid: string;
  hash: string;
}

export interface LicenseServerConfig {
  url: string;
  timeout: number;
  retryAttempts: number;
  heartbeatInterval: number;
  encryptionKey: string;
}

export interface BlacklistEntry {
  hardwareId: string;
  reason: string;
  blacklistedAt: number;
  blacklistedBy: string;
  permanent: boolean;
  expiresAt?: number;
}

export class LicenseSystemV3 {
  private static instance: LicenseSystemV3;
  private logger = logger;
  private cache = CacheSystem.getInstance();
  private license: LicenseV3 | null = null;
  private token: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private validationFailures = 0;
  private lastValidation = 0;
  private isShuttingDown = false;
  
  private readonly config: LicenseServerConfig = {
    url: process.env.LICENSE_SERVER_URL || 'https://license.dragon-telegram.pro',
    timeout: 10000,
    retryAttempts: 3,
    heartbeatInterval: 5 * 60 * 1000, // 5 minutes
    encryptionKey: process.env.LICENSE_ENCRYPTION_KEY || 'default-key-change-in-production'
  };

  private httpClient: AxiosInstance;

  private constructor() {
    this.httpClient = axios.create({
      baseURL: this.config.url,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dragon-Telegram-Pro/v6.0',
        'X-Client-Version': '6.0.0'
      }
    });

    // Setup interceptors
    this.setupInterceptors();
  }

  static getInstance(): LicenseSystemV3 {
    if (!this.instance) {
      this.instance = new LicenseSystemV3();
    }
    return this.instance;
  }

  /**
   * Initialize license system
   */
  async initialize(): Promise<boolean> {
    this.logger.info('[LicenseV3] Initializing license system v3.0...');

    try {
      // 1. Check if blacklisted
      const hardwareId = await HardwareID.generate();
      if (await this.isBlacklisted(hardwareId)) {
        this.logger.error('[LicenseV3] Hardware ID is blacklisted');
        await this.shutdown('Blacklisted hardware detected');
        return false;
      }

      // 2. Load local license
      const localLicense = await this.loadLocalLicense();
      
      if (!localLicense) {
        this.logger.warn('[LicenseV3] No local license found');
        return false;
      }

      // 3. Verify hardware binding
      if (!await this.verifyHardwareBinding(localLicense)) {
        this.logger.error('[LicenseV3] Hardware binding verification failed');
        return false;
      }

      // 4. Verify integrity
      if (!this.verifyLicenseIntegrity(localLicense)) {
        this.logger.error('[LicenseV3] License integrity check failed');
        return false;
      }

      // 5. Validate with remote server
      const validation = await this.validateWithServer(localLicense);
      
      if (!validation.valid) {
        this.logger.error('[LicenseV3] Remote validation failed', { reason: validation.reason });
        
        if (validation.action === 'shutdown') {
          await this.shutdown(validation.reason || 'License validation failed');
          return false;
        }
        
        return false;
      }

      // 6. Store license
      this.license = validation.license || localLicense;
      this.token = validation.token || null;

      // 7. Start heartbeat
      this.startHeartbeat();

      // 8. Initialize usage tracking
      await this.initializeUsageTracking();

      this.logger.info('[LicenseV3] ✅ License system initialized successfully', {
        type: this.license.type,
        expiresAt: new Date(this.license.expiresAt).toISOString(),
        features: this.license.features.length
      });

      return true;

    } catch (error: any) {
      this.logger.error('[LicenseV3] Initialization failed', { error: error.message });
      return false;
    }
  }

  /**
   * Activate new license
   */
  async activateLicense(licenseKey: string): Promise<{ success: boolean; message: string }> {
    this.logger.info('[LicenseV3] Activating license', { licenseKey: licenseKey.substring(0, 8) + '...' });

    try {
      const hardwareId = await HardwareID.generate();
      const fingerprint = await HardwareID.generateFingerprint();

      const response = await this.httpClient.post('/api/v3/license/activate', {
        licenseKey,
        hardwareId,
        fingerprint,
        clientVersion: '6.0.0',
        timestamp: Date.now()
      });

      if (response.data.success) {
        const license: LicenseV3 = response.data.license;
        
        // Save locally
        await this.saveLocalLicense(license);
        
        // Initialize
        await this.initialize();
        
        return {
          success: true,
          message: 'License activated successfully'
        };
      }

      return {
        success: false,
        message: response.data.message || 'Activation failed'
      };

    } catch (error: any) {
      this.logger.error('[LicenseV3] Activation failed', { error: error.message });
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Validate license with remote server
   */
  private async validateWithServer(license: LicenseV3): Promise<LicenseValidationResponse> {
    try {
      const response = await this.httpClient.post('/api/v3/license/validate', {
        licenseKey: license.key,
        hardwareId: license.hardwareId,
        fingerprint: license.hardwareFingerprint,
        clientVersion: '6.0.0',
        usage: license.usage,
        timestamp: Date.now()
      });

      return response.data;

    } catch (error: any) {
      this.logger.error('[LicenseV3] Server validation failed', { error: error.message });
      
      // Check if offline grace period applies
      if (this.isOfflineGracePeriodValid(license)) {
        return {
          valid: true,
          license,
          reason: 'Offline grace period',
          action: 'continue'
        };
      }

      return {
        valid: false,
        reason: 'Cannot reach license server',
        action: 'warning'
      };
    }
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval) as any;

    this.logger.info('[LicenseV3] Heartbeat started', { interval: this.config.heartbeatInterval });
  }

  /**
   * Send heartbeat to server
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.license || !this.token || this.isShuttingDown) {
      return;
    }

    try {
      const response = await this.httpClient.post('/api/v3/license/heartbeat', {
        licenseKey: this.license.key,
        hardwareId: this.license.hardwareId,
        usage: this.license.usage,
        systemInfo: await this.getSystemInfo(),
        timestamp: Date.now()
      }, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (response.data.action === 'shutdown') {
        this.logger.error('[LicenseV3] Kill switch activated');
        await this.shutdown('Kill switch activated by license server');
        return;
      }

      if (response.data.action === 'deactivate') {
        this.logger.warn('[LicenseV3] License deactivated');
        await this.deactivateLicense();
        return;
      }

      // Update license if provided
      if (response.data.license && this.license) {
        this.license = { ...this.license, ...response.data.license };
        if (this.license) {
          await this.saveLocalLicense(this.license);
        }
      }

      // Reset failure counter
      this.validationFailures = 0;
      this.lastValidation = Date.now();

    } catch (error: any) {
      this.validationFailures++;
      this.logger.error('[LicenseV3] Heartbeat failed', { 
        error: error.message, 
        failures: this.validationFailures 
      });

      // Shutdown after too many failures
      if (this.validationFailures >= 3) {
        await this.shutdown('Too many validation failures');
      }
    }
  }

  /**
   * Check if hardware is blacklisted
   */
  private async isBlacklisted(hardwareId: string): Promise<boolean> {
    try {
      const cacheKey = `blacklist:${hardwareId}`;
      const cached = await this.cache.get<boolean>(cacheKey);
      
      if (cached !== null) {
        return cached;
      }

      const response = await this.httpClient.get(`/api/v3/blacklist/${hardwareId}`);
      const isBlacklisted = response.data.blacklisted;

      // Cache for 1 hour
      await this.cache.set(cacheKey, isBlacklisted, { ttl: 3600 });

      return isBlacklisted;

    } catch (error: any) {
      this.logger.error('[LicenseV3] Blacklist check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Verify hardware binding
   */
  private async verifyHardwareBinding(license: LicenseV3): Promise<boolean> {
    const currentHardwareId = await HardwareID.generate();
    const currentFingerprint = await HardwareID.generateFingerprint();

    // Exact match
    if (license.hardwareId === currentHardwareId) {
      return true;
    }

    // Partial match (70% similarity)
    const similarity = this.calculateHardwareSimilarity(
      license.hardwareFingerprint,
      JSON.stringify(currentFingerprint)
    );

    return similarity >= 0.7;
  }

  /**
   * Calculate hardware similarity
   */
  private calculateHardwareSimilarity(fingerprint1: string, fingerprint2: string): number {
    // Simple similarity calculation - in production, use more sophisticated algorithm
    const chars1 = new Set(fingerprint1);
    const chars2 = new Set(fingerprint2);
    const intersection = new Set([...chars1].filter(x => chars2.has(x)));
    const union = new Set([...chars1, ...chars2]);
    
    return intersection.size / union.size;
  }

  /**
   * Verify license integrity
   */
  private verifyLicenseIntegrity(license: LicenseV3): boolean {
    try {
      // Verify signature
      const dataToSign = this.getLicenseDataString(license);
      const expectedSignature = crypto
        .createHmac('sha256', this.config.encryptionKey)
        .update(dataToSign)
        .digest('hex');

      if (license.signature !== expectedSignature) {
        return false;
      }

      // Verify checksum
      const expectedChecksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(license))
        .digest('hex');

      return license.checksum === expectedChecksum;

    } catch (error) {
      this.logger.error('[LicenseV3] Integrity verification failed', { error });
      return false;
    }
  }

  /**
   * Check if offline grace period is valid
   */
  private isOfflineGracePeriodValid(license: LicenseV3): boolean {
    const gracePeriod = 6 * 60 * 60 * 1000; // 6 hours
    const timeSinceLastValidation = Date.now() - this.lastValidation;
    
    return timeSinceLastValidation < gracePeriod;
  }

  /**
   * Get system information for monitoring
   */
  private async getSystemInfo(): Promise<any> {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: Date.now()
    };
  }

  /**
   * Load local license
   */
  private async loadLocalLicense(): Promise<LicenseV3 | null> {
    try {
      const licensePath = path.join(process.cwd(), '.license-v3');
      
      if (!fs.existsSync(licensePath)) {
        return null;
      }

      const encrypted = fs.readFileSync(licensePath, 'utf8');
      const { iv, data, tag } = JSON.parse(encrypted);

      // Decrypt
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(this.config.encryptionKey, 'hex'),
        Buffer.from(iv, 'hex')
      );

      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted) as LicenseV3;

    } catch (error: any) {
      this.logger.error('[LicenseV3] Failed to load local license', { error: error.message });
      return null;
    }
  }

  /**
   * Save local license
   */
  private async saveLocalLicense(license: LicenseV3): Promise<void> {
    try {
      const licensePath = path.join(process.cwd(), '.license-v3');
      
      // Add checksum
      license.checksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(license))
        .digest('hex');

      // Sign license
      const dataToSign = this.getLicenseDataString(license);
      license.signature = crypto
        .createHmac('sha256', this.config.encryptionKey)
        .update(dataToSign)
        .digest('hex');

      const data = JSON.stringify(license);

      // Encrypt
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(this.config.encryptionKey, 'hex'),
        iv
      );

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      const payload = JSON.stringify({
        iv: iv.toString('hex'),
        data: encrypted,
        tag: authTag.toString('hex')
      });

      fs.writeFileSync(licensePath, payload, 'utf8');

    } catch (error: any) {
      this.logger.error('[LicenseV3] Failed to save local license', { error: error.message });
      throw error;
    }
  }

  /**
   * Get license data string for signing
   */
  private getLicenseDataString(license: LicenseV3): string {
    return [
      license.key,
      license.type,
      license.hardwareId,
      license.hardwareFingerprint,
      license.issuedAt,
      license.expiresAt,
      license.features.map(f => f.id).join(','),
      JSON.stringify(license.limits)
    ].join('|');
  }

  /**
   * Initialize usage tracking
   */
  private async initializeUsageTracking(): Promise<void> {
    if (!this.license) return;

    const cacheKey = `license-usage:${this.license.hardwareId}`;
    const cached = await this.cache.get<LicenseUsage>(cacheKey);
    
    if (cached) {
      this.license.usage = cached;
    } else {
      // Initialize fresh usage
      this.license.usage = {
        accountsCreated: 0,
        operationsToday: 0,
        extractionsThisHour: 0,
        messagesThisHour: 0,
        channelsCreated: 0,
        autoReplyRules: 0,
        concurrentOperations: 0,
        lastReset: Date.now()
      };
    }
  }

  /**
   * Setup HTTP interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug('[LicenseV3] API Request', { 
          method: config.method, 
          url: config.url 
        });
        return config;
      },
      (error) => {
        this.logger.error('[LicenseV3] Request interceptor error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug('[LicenseV3] API Response', { 
          status: response.status,
          url: response.config.url 
        });
        return response;
      },
      (error) => {
        this.logger.error('[LicenseV3] Response interceptor error', { 
          status: error.response?.status,
          url: error.config?.url 
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generate client ID
   */
  private async generateClientId(): Promise<string> {
    const hardwareId = await HardwareID.generate();
    return crypto.createHash('sha256')
      .update(hardwareId + 'dragon-telegram-pro-v6')
      .digest('hex');
  }

  /**
   * Check if feature is enabled
   */
  hasFeature(featureId: string): boolean {
    if (!this.license) return false;
    
    const feature = this.license.features.find(f => f.id === featureId);
    return feature?.isEnabled || false;
  }

  /**
   * Get license limits
   */
  getLimits(): LicenseLimits | null {
    return this.license?.limits || null;
  }

  /**
   * Check if within limits
   */
  checkLimit(operation: string, increment: number = 1): boolean {
    if (!this.license) return false;

    const limits = this.license.limits;
    const usage = this.license.usage;

    switch (operation) {
      case 'accounts':
        return usage.accountsCreated + increment <= limits.maxAccounts;
      
      case 'operations':
        return usage.operationsToday + increment <= limits.maxOperationsPerDay;
      
      case 'extractions':
        return usage.extractionsThisHour + increment <= limits.maxExtractionsPerHour;
      
      case 'messages':
        return usage.messagesThisHour + increment <= limits.maxMessagesPerHour;
      
      case 'channels':
        return usage.channelsCreated + increment <= limits.maxChannels;
      
      case 'autoReplyRules':
        return usage.autoReplyRules + increment <= limits.maxAutoReplyRules;
      
      case 'concurrent':
        return usage.concurrentOperations + increment <= limits.maxConcurrentOperations;
      
      default:
        return true;
    }
  }

  /**
   * Update usage statistics
   */
  async updateUsage(operation: string, increment: number = 1): Promise<void> {
    if (!this.license) return;

    const usage = this.license.usage;

    switch (operation) {
      case 'accounts':
        usage.accountsCreated += increment;
        break;
      case 'operations':
        usage.operationsToday += increment;
        break;
      case 'extractions':
        usage.extractionsThisHour += increment;
        break;
      case 'messages':
        usage.messagesThisHour += increment;
        break;
      case 'channels':
        usage.channelsCreated += increment;
        break;
      case 'autoReplyRules':
        usage.autoReplyRules += increment;
        break;
      case 'concurrent':
        usage.concurrentOperations += increment;
        break;
    }

    // Save to cache
    const cacheKey = `license-usage:${this.license.hardwareId}`;
    await this.cache.set(cacheKey, usage, { ttl: 24 * 3600 }); // 24 hours
  }

  /**
   * Deactivate license
   */
  async deactivateLicense(): Promise<void> {
    this.logger.info('[LicenseV3] Deactivating license');

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Clear local license
    try {
      const licensePath = path.join(process.cwd(), '.license-v3');
      if (fs.existsSync(licensePath)) {
        fs.unlinkSync(licensePath);
      }
    } catch (error: any) {
      this.logger.error('[LicenseV3] Failed to delete license file', { error: error.message });
    }

    // Clear cache
    await this.cache.delete(`license-usage:${this.license?.hardwareId}`);

    // Reset state
    this.license = null;
    this.token = null;
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(reason: string): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    this.logger.error('[LicenseV3] 🛑 Shutting down', { reason });

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Give 5 seconds for graceful shutdown
    setTimeout(() => {
      this.logger.error('[LicenseV3] 💀 Process terminated');
      process.exit(1);
    }, 5000);
  }

  /**
   * Get current license
   */
  getLicense(): LicenseV3 | null {
    return this.license;
  }

  /**
   * Check if license is valid
   */
  isValid(): boolean {
    if (!this.license) return false;
    
    return this.license.isActive && 
           Date.now() < this.license.expiresAt &&
           !this.isShuttingDown;
  }
}

// Export singleton
export const licenseSystemV3 = LicenseSystemV3.getInstance();
