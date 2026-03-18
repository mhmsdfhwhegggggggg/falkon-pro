/**
 * License Manager - Persistent license management system
 * Handles license validation and activation using the database
 */

import crypto from 'crypto';
import { encryptString, decryptString } from '../_core/crypto';
import { db, licenses } from '../db';
import { eq } from 'drizzle-orm';

export interface License {
  id: number;
  userId: number;
  licenseKey: string;
  type: 'trial' | 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'expired' | 'suspended' | 'pending' | 'inactive';
  createdAt: Date;
  expiresAt: Date | null;
  maxAccounts: number;
  maxMessages: number;
  features: string[];
  hardwareId?: string | null;
  activatedAt?: Date | null;
  lastValidated?: Date | null;
  usageCount: number;
  maxUsage?: number | null;
  autoRenew: boolean;
  renewalPrice?: string | null;
}

export interface LicenseValidationResult {
  valid: boolean;
  license?: License;
  reason?: string;
  daysRemaining?: number;
  errors: string[];
  subscription?: any;
  usageRemaining?: number;
  warnings: string[];
}

export class LicenseManager {
  private static instance: LicenseManager;

  private licenseCache = new Map<number, { license: License | null, timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds

  private constructor() { }

  static getInstance(): LicenseManager {
    if (!this.instance) {
      this.instance = new LicenseManager();
    }
    return this.instance;
  }

  /**
   * Generate license key
   */
  generateLicenseKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (i < 3) key += '-';
    }
    return key;
  }

  /**
   * Create license in DB
   */
  async createLicense(userId: number, type: string, durationDays: number): Promise<License> {
    const licenseType = type as License['type'];
    return this.generateLicense({
      userId,
      type: licenseType,
      durationDays,
      maxAccounts: this.getMaxAccountsForType(licenseType),
      maxMessages: this.getMaxOperationsForType(licenseType),
      features: this.getFeaturesForType(licenseType)
    });
  }

  /**
   * Comprehensive license generation
   */
  async generateLicense(input: {
    userId: number;
    type: string;
    durationDays: number;
    maxAccounts?: number;
    maxMessages?: number;
    features?: string[];
    autoRenew?: boolean;
    renewalPrice?: number;
  }): Promise<License> {
    const licenseType = input.type as License['type'];
    
    const [newLicense] = await db.insert(licenses).values({
      userId: input.userId,
      licenseKey: this.generateLicenseKey(),
      type: licenseType,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000),
      maxAccounts: input.maxAccounts || this.getMaxAccountsForType(licenseType),
      maxMessages: input.maxMessages || this.getMaxOperationsForType(licenseType),
      features: input.features || this.getFeaturesForType(licenseType),
      usageCount: 0,
      autoRenew: input.autoRenew || false,
      renewalPrice: input.renewalPrice ? input.renewalPrice.toString() : null
    }).returning();

    return newLicense as unknown as License;
  }

  /**
   * Activate license
   */
  async activateLicense(key: string, hardwareId?: string): Promise<boolean> {
    const license = await db.query.licenses.findFirst({
      where: eq(licenses.licenseKey, key)
    });

    if (!license) {
      return false;
    }

    if (license.status === 'expired' || license.status === 'suspended') {
      return false;
    }

    // Update license
    await db.update(licenses).set({
      status: 'active',
      activatedAt: new Date(),
      lastValidated: new Date(),
      hardwareId: hardwareId || license.hardwareId
    }).where(eq(licenses.id, license.id));

    // Invalidate cache
    this.licenseCache.delete(license.userId);

    return true;
  }

  /**
   * Deactivate license
   */
  async deactivateLicense(key: string): Promise<boolean> {
    const license = await db.query.licenses.findFirst({
      where: eq(licenses.licenseKey, key)
    });

    if (!license) return false;

    await db.update(licenses).set({
      status: 'pending',
      hardwareId: null
    }).where(eq(licenses.id, license.id));

    return true;
  }

  /**
   * Validate current license or a specific key
   */
  async validateLicense(key?: string, hardwareId?: string): Promise<LicenseValidationResult> {
    if (!key) {
      return { valid: false, reason: 'No license key provided', errors: ['No license key provided'], warnings: [] };
    }

    const license = await db.query.licenses.findFirst({
      where: eq(licenses.licenseKey, key)
    });

    if (!license) {
      return { valid: false, reason: 'License not found', errors: ['License not found'], warnings: [] };
    }

    const warnings: string[] = [];

    // Check expiration
    if (license.expiresAt && license.expiresAt < new Date()) {
      await db.update(licenses).set({ status: 'expired' }).where(eq(licenses.id, license.id));
      return { valid: false, reason: 'License expired', errors: ['License expired'], warnings: [] };
    }

    // Check hardware ID if provided and if license is bound
    if (hardwareId && license.hardwareId && license.hardwareId !== hardwareId) {
      return { valid: false, reason: 'Hardware ID mismatch', errors: ['Hardware ID mismatch'], warnings: [] };
    }

    // Update last validated
    await db.update(licenses).set({ lastValidated: new Date() }).where(eq(licenses.id, license.id));

    const daysRemaining = license.expiresAt ? Math.ceil(
      (license.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    ) : 0;

    // Check if close to expiring
    if (daysRemaining <= 3) {
      warnings.push('License expires soon');
    }

    return {
      valid: true,
      license: license as unknown as License,
      daysRemaining: Math.max(0, daysRemaining),
      errors: [],
      warnings,
      subscription: { id: 1, autoRenew: license.autoRenew, nextBillingDate: license.expiresAt }
    };
  }

  /**
   * Renew subscription
   */
  async renewSubscription(subscriptionId: number): Promise<boolean> {
    // Logic would be to find the license associated with subscription and extend expiry
    return true;
  }

  /**
   * Encryption wrappers
   */
  encryptData(data: string): string {
    return encryptString(data);
  }

  decryptData(data: string): string {
    return decryptString(data);
  }

  /**
   * Get current license info (Helper for context)
   */
  async getLicenseByKey(key: string): Promise<License | null> {
    const license = await db.query.licenses.findFirst({
      where: eq(licenses.licenseKey, key)
    });
    return (license as unknown as License) || null;
  }

  async getUserActiveLicense(userId: number): Promise<License | null> {
    const cached = this.licenseCache.get(userId);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.license;
    }

    const license = await db.query.licenses.findFirst({
      where: eq(licenses.userId, userId)
    });

    let result: License | null = null;
    if (license && license.status === 'active') {
      result = license as unknown as License;
    }
    
    this.licenseCache.set(userId, { license: result, timestamp: now });
    return result;
  }

  private getMaxAccountsForType(type: string): number {
    switch (type) {
      case 'trial': return 5;
      case 'basic': return 50;
      case 'pro': return 200;
      case 'enterprise': return 1000;
      default: return 5;
    }
  }

  private getMaxOperationsForType(type: string): number {
    switch (type) {
      case 'trial': return 100;
      case 'basic': return 1000;
      case 'pro': return 10000;
      case 'enterprise': return 100000;
      default: return 100;
    }
  }

  private getFeaturesForType(type: string): string[] {
    const baseFeatures = ['dashboard', 'account_management'];

    switch (type) {
      case 'trial':
        return [...baseFeatures, 'basic_extraction'];
      case 'basic':
        return [...baseFeatures, 'extraction', 'bulk_operations'];
      case 'pro':
        return [...baseFeatures, 'extraction', 'bulk_operations', 'advanced_filters', 'anti_ban'];
      case 'enterprise':
        return [...baseFeatures, 'extraction', 'bulk_operations', 'advanced_filters', 'anti_ban', 'api_access', 'white_label'];
      default:
        return baseFeatures;
    }
  }

  async trackUsage(licenseKey: string, action: string, metadata: any): Promise<void> {
    const license = await db.query.licenses.findFirst({ where: eq(licenses.licenseKey, licenseKey) });
    if (license) {
      await db.update(licenses).set({
        usageCount: license.usageCount + 1
      }).where(eq(licenses.id, license.id));
    }
  }

  async createSubscription(input: any): Promise<number> {
    return Math.floor(Math.random() * 100000);
  }

  async cancelSubscription(subscriptionId: number): Promise<boolean> {
    return true;
  }

  async getLicenseAnalytics(): Promise<any> {
    // This would need aggregation queries
    return {
      totalLicenses: 0,
      activeLicenses: 0,
      expiredLicenses: 0,
    };
  }

  static generateHardwareId(): string {
    // In a real scenario, this should verify signature from client
    return 'HWID-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  }
}

export const licenseManager = LicenseManager.getInstance();
