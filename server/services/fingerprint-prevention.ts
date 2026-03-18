/**
 * Fingerprint Prevention System
 * 
 * Prevents device fingerprinting and makes each account appear unique.
 * Simulates human behavior patterns to avoid detection.
 * 
 * Features:
 * - Random device characteristics
 * - Human-like typing patterns
 * - Variable online status
 * - Realistic activity patterns
 * - Time-zone aware behavior
 * 
 * @module FingerprintPrevention
 * @author Manus AI
 * @version 2.0.0
 */

import Redis from 'ioredis';
import * as crypto from 'crypto';

export interface DeviceFingerprint {
  device: string;
  system: string;
  appVersion: string;
  langCode: string;
  systemLangCode: string;
  deviceModel: string;
  systemVersion: string;
}

export interface BehaviorProfile {
  typingSpeed: number;        // WPM (words per minute)
  thinkingDelay: number;      // ms between messages
  onlinePattern: 'active' | 'recently' | 'within_week' | 'within_month';
  activeHours: number[];      // Hours of day when active (0-23)
  timezone: string;
  pauseBetweenMessages: number; // ms
  messageVariation: number;   // 0-1, how much to vary message timing
}

export interface TypingSimulation {
  typingTimeMs: number;
  thinkingTimeMs: number;
  totalDelayMs: number;
  keystrokes: number;
}

export class FingerprintPrevention {
  private static redis: Redis;
  
  /**
   * Common device configurations
   */
  private static readonly DEVICES = [
    { device: 'iPhone 14 Pro', system: 'iOS 17.2', appVersion: '10.2.1' },
    { device: 'iPhone 13', system: 'iOS 16.5', appVersion: '10.1.3' },
    { device: 'iPhone 12 Pro Max', system: 'iOS 16.7', appVersion: '10.0.8' },
    { device: 'Samsung Galaxy S23 Ultra', system: 'Android 14', appVersion: '10.2.0' },
    { device: 'Samsung Galaxy S22', system: 'Android 13', appVersion: '10.1.5' },
    { device: 'Google Pixel 8 Pro', system: 'Android 14', appVersion: '10.2.0' },
    { device: 'Google Pixel 7', system: 'Android 14', appVersion: '10.1.9' },
    { device: 'OnePlus 11', system: 'Android 13', appVersion: '10.1.6' },
    { device: 'Xiaomi 13 Pro', system: 'Android 13', appVersion: '10.1.4' },
    { device: 'Huawei P60 Pro', system: 'Android 13', appVersion: '10.0.9' },
  ];
  
  /**
   * Common timezones
   */
  private static readonly TIMEZONES = [
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Dubai',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Australia/Sydney',
  ];
  
  /**
   * Initialize with Redis client
   */
  static initialize(redis: Redis): void {
    this.redis = redis;
    console.log('[FingerprintPrevention] Initialized');
  }
  
  /**
   * Generate or retrieve device fingerprint for account
   */
  static async getDeviceFingerprint(accountId: number): Promise<DeviceFingerprint> {
    try {
      const key = `fingerprint:device:${accountId}`;
      const cached = await this.redis.get(key);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Generate new fingerprint
      const device = this.randomElement(this.DEVICES);
      const langCodes = ['en', 'ar', 'es', 'fr', 'de', 'pt', 'ru', 'zh', 'ja', 'ko'];
      const langCode = this.randomElement(langCodes);
      
      const fingerprint: DeviceFingerprint = {
        device: device.device,
        system: device.system,
        appVersion: device.appVersion,
        langCode,
        systemLangCode: langCode,
        deviceModel: device.device.replace(/ /g, '_'),
        systemVersion: device.system.split(' ')[1] || '1.0',
      };
      
      // Cache for 30 days
      await this.redis.setex(key, 86400 * 30, JSON.stringify(fingerprint));
      
      return fingerprint;
      
    } catch (error: any) {
      console.error('[FingerprintPrevention] Error getting device fingerprint:', error.message);
      
      // Return default
      return {
        device: 'iPhone 14 Pro',
        system: 'iOS 17.2',
        appVersion: '10.2.1',
        langCode: 'en',
        systemLangCode: 'en',
        deviceModel: 'iPhone_14_Pro',
        systemVersion: '17.2',
      };
    }
  }
  
  /**
   * Generate or retrieve behavior profile for account
   */
  static async getBehaviorProfile(accountId: number): Promise<BehaviorProfile> {
    try {
      const key = `fingerprint:behavior:${accountId}`;
      const cached = await this.redis.get(key);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Generate new profile
      const typingSpeed = 40 + Math.random() * 80; // 40-120 WPM
      const thinkingDelay = 1000 + Math.random() * 4000; // 1-5 seconds
      
      const onlinePatterns: BehaviorProfile['onlinePattern'][] = [
        'active',
        'recently',
        'within_week',
        'within_month',
      ];
      
      const onlinePattern = this.randomElement(onlinePatterns);
      
      // Generate realistic active hours (e.g., 8am-11pm)
      const startHour = 6 + Math.floor(Math.random() * 4); // 6-9am
      const endHour = 20 + Math.floor(Math.random() * 4); // 8-11pm
      const activeHours: number[] = [];
      
      for (let h = startHour; h <= endHour; h++) {
        // Add some randomness (not active every hour)
        if (Math.random() > 0.2) {
          activeHours.push(h);
        }
      }
      
      const timezone = this.randomElement(this.TIMEZONES);
      const pauseBetweenMessages = 2000 + Math.random() * 8000; // 2-10 seconds
      const messageVariation = 0.3 + Math.random() * 0.4; // 0.3-0.7
      
      const profile: BehaviorProfile = {
        typingSpeed,
        thinkingDelay,
        onlinePattern,
        activeHours,
        timezone,
        pauseBetweenMessages,
        messageVariation,
      };
      
      // Cache for 30 days
      await this.redis.setex(key, 86400 * 30, JSON.stringify(profile));
      
      return profile;
      
    } catch (error: any) {
      console.error('[FingerprintPrevention] Error getting behavior profile:', error.message);
      
      // Return default
      return {
        typingSpeed: 80,
        thinkingDelay: 2000,
        onlinePattern: 'recently',
        activeHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
        timezone: 'America/New_York',
        pauseBetweenMessages: 5000,
        messageVariation: 0.5,
      };
    }
  }
  
  /**
   * Simulate human typing for a message
   * Returns realistic delays
   */
  static async simulateTyping(
    text: string,
    accountId: number
  ): Promise<TypingSimulation> {
    const profile = await this.getBehaviorProfile(accountId);
    
    // Calculate base typing time
    const words = text.split(/\s+/).length;
    const baseTypingTime = (words / profile.typingSpeed) * 60 * 1000; // Convert to ms
    
    // Add randomness (±30%)
    const randomFactor = 0.7 + Math.random() * 0.6;
    const typingTime = baseTypingTime * randomFactor;
    
    // Calculate thinking time (pauses between sentences)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length;
    const thinkingTime = sentences * (profile.thinkingDelay * (0.5 + Math.random()));
    
    // Add random micro-pauses (simulating thinking while typing)
    const microPauses = Math.floor(words / 5); // Pause every 5 words
    const microPauseTime = microPauses * (200 + Math.random() * 800); // 200-1000ms each
    
    const totalDelay = Math.floor(typingTime + thinkingTime + microPauseTime);
    
    return {
      typingTimeMs: Math.floor(typingTime),
      thinkingTimeMs: Math.floor(thinkingTime + microPauseTime),
      totalDelayMs: totalDelay,
      keystrokes: text.length,
    };
  }
  
  /**
   * Calculate delay between messages
   * Varies based on behavior profile and time of day
   */
  static async calculateMessageDelay(accountId: number): Promise<number> {
    const profile = await this.getBehaviorProfile(accountId);
    
    // Base delay
    let delay = profile.pauseBetweenMessages;
    
    // Add variation
    const variation = delay * profile.messageVariation;
    delay = delay - variation + Math.random() * variation * 2;
    
    // Adjust for time of day
    const hour = new Date().getHours();
    
    if (!profile.activeHours.includes(hour)) {
      // Outside active hours - much longer delay
      delay *= 2 + Math.random() * 3; // 2-5x longer
    }
    
    // Add random "distraction" delays (10% chance)
    if (Math.random() < 0.1) {
      delay += 10000 + Math.random() * 30000; // 10-40 seconds extra
    }
    
    return Math.floor(delay);
  }
  
  /**
   * Check if account should be active now
   * Based on behavior profile and time of day
   */
  static async shouldBeActive(accountId: number): Promise<boolean> {
    const profile = await this.getBehaviorProfile(accountId);
    const hour = new Date().getHours();
    
    // Check if in active hours
    if (!profile.activeHours.includes(hour)) {
      // Small chance (5%) to be active outside normal hours
      return Math.random() < 0.05;
    }
    
    // In active hours - high probability
    return Math.random() < 0.9;
  }
  
  /**
   * Generate realistic read time for a message
   * Based on message length and reading speed
   */
  static calculateReadTime(messageLength: number): number {
    // Average reading speed: 200-300 words per minute
    const wordsPerMinute = 200 + Math.random() * 100;
    const words = Math.ceil(messageLength / 5); // Approximate word count
    
    const baseReadTime = (words / wordsPerMinute) * 60 * 1000; // ms
    
    // Add randomness and minimum time
    const readTime = Math.max(1000, baseReadTime * (0.7 + Math.random() * 0.6));
    
    return Math.floor(readTime);
  }
  
  /**
   * Generate random user agent string
   */
  static async generateUserAgent(accountId: number): Promise<string> {
    const fingerprint = await this.getDeviceFingerprint(accountId);
    
    if (fingerprint.system.includes('iOS')) {
      return `Telegram-iOS/${fingerprint.appVersion} (${fingerprint.device}; iOS ${fingerprint.systemVersion}; Scale/3.00)`;
    } else {
      return `Telegram-Android/${fingerprint.appVersion} (${fingerprint.device}; Android ${fingerprint.systemVersion}; SDK 33)`;
    }
  }
  
  /**
   * Randomize client connection parameters
   */
  static async getConnectionParams(accountId: number): Promise<{
    connectionRetries: number;
    retryDelay: number;
    timeout: number;
    requestTimeout: number;
  }> {
    // Add randomness to connection parameters
    return {
      connectionRetries: 3 + Math.floor(Math.random() * 3), // 3-5
      retryDelay: 100 + Math.floor(Math.random() * 200), // 100-300ms
      timeout: 8 + Math.floor(Math.random() * 5), // 8-12 seconds
      requestTimeout: 8 + Math.floor(Math.random() * 5), // 8-12 seconds
    };
  }
  
  /**
   * Generate realistic session parameters
   */
  static async getSessionParams(accountId: number): Promise<{
    deviceModel: string;
    systemVersion: string;
    appVersion: string;
    langCode: string;
    systemLangCode: string;
  }> {
    const fingerprint = await this.getDeviceFingerprint(accountId);
    
    return {
      deviceModel: fingerprint.deviceModel,
      systemVersion: fingerprint.systemVersion,
      appVersion: fingerprint.appVersion,
      langCode: fingerprint.langCode,
      systemLangCode: fingerprint.systemLangCode,
    };
  }
  
  /**
   * Calculate realistic delay for operation type
   */
  static async calculateOperationDelay(
    operationType: 'message' | 'join' | 'add_user' | 'extract',
    accountId: number
  ): Promise<number> {
    const profile = await this.getBehaviorProfile(accountId);
    
    // Base delays for different operations
    const baseDelays = {
      message: profile.pauseBetweenMessages,
      join: 5000 + Math.random() * 10000, // 5-15 seconds
      add_user: 3000 + Math.random() * 7000, // 3-10 seconds
      extract: 1000 + Math.random() * 2000, // 1-3 seconds
    };
    
    let delay = baseDelays[operationType];
    
    // Add variation
    const variation = delay * profile.messageVariation;
    delay = delay - variation + Math.random() * variation * 2;
    
    return Math.floor(delay);
  }
  
  /**
   * Reset fingerprint for account (generates new one)
   */
  static async resetFingerprint(accountId: number): Promise<void> {
    try {
      await this.redis.del(`fingerprint:device:${accountId}`);
      await this.redis.del(`fingerprint:behavior:${accountId}`);
      console.log(`[FingerprintPrevention] Reset fingerprint for account ${accountId}`);
    } catch (error: any) {
      console.error('[FingerprintPrevention] Error resetting fingerprint:', error.message);
    }
  }
  
  /**
   * Helper: Get random element from array
   */
  private static randomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }
  
  /**
   * Helper: Generate random string
   */
  private static randomString(length: number): string {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
  }
}
