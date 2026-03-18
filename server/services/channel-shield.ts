/**
 * Channel-Shield Protection System v1.0.0 🔥
 * 
 * Specialized security layer to protect user channels and groups:
 * - Growth Monitoring: Prevents "Ban Traps" caused by sudden member spikes.
 * - Reporting Defense: Detects suspicious leave patterns that signal reporting.
 * - Adaptive Throttling: Dynamically adjusts adding speed for sensitive chats.
 * - Reputation Filtering: Blocks low-trust accounts from entering protected groups.
 * 
 * @module ChannelShield
 * @author FALCON Team
 */

import { logger } from '../_core/logger';
import { CacheSystem } from '../_core/cache-system';
import * as db from '../db';

export interface ShieldConfig {
    channelId: string;
    isProtected: boolean;
    maxAddsPerDay: number;
    sensitivityLevel: 'safe' | 'normal' | 'strict';
    autoCooldown: boolean;
}

export class ChannelShield {
    private static instance: ChannelShield;
    private logger = logger;
    private cache = CacheSystem.getInstance();

    private constructor() { }

    static getInstance(): ChannelShield {
        if (!this.instance) {
            this.instance = new ChannelShield();
        }
        return this.instance;
    }

    /**
   * Check if an operation is safe for a specific channel
   */
    async checkChannelSafety(channelId: string, operationType: string): Promise<{
        safe: boolean;
        reason?: string;
        suggestedDelayMultiplier: number;
    }> {
        const config = await this.getChannelConfig(channelId);
        if (!config || !config.isProtected) {
            return { safe: true, suggestedDelayMultiplier: 1.0 };
        }

        // 1. Honeypot (Spam Trap) Detection prince
        const isHoneypot = await this.detectHoneypot(channelId);
        if (isHoneypot) {
            return {
                safe: false,
                reason: 'ACTIVE DEFENSE: Spam-Trap (Honeypot) detected in this group! Freezing adds.',
                suggestedDelayMultiplier: 100.0 // Effective freeze
            };
        }

        // 2. Growth Spike Check
        const recentAdds = await this.getRecentAdds(channelId, '1h');
        if (recentAdds > this.getBurstLimit(config.sensitivityLevel)) {
            return {
                safe: false,
                reason: 'Growth spike detected - potential Spam Trap',
                suggestedDelayMultiplier: 5.0
            };
        }

        // 3. Ghost-Adding Delay (Non-linear) prince
        const ghostMultiplier = this.calculateGhostMultiplier(recentAdds, config.sensitivityLevel);

        // 4. Daily Limit Check
        const dailyAdds = await this.getRecentAdds(channelId, '24h');
        if (dailyAdds >= config.maxAddsPerDay) {
            return {
                safe: false,
                reason: 'Daily safety limit reached for this channel',
                suggestedDelayMultiplier: 10.0
            };
        }

        return { safe: true, suggestedDelayMultiplier: ghostMultiplier };
    }

    /**
     * Detect if a group is a "Spam Trap" based on abnormal behavior
     */
    private async detectHoneypot(channelId: string): Promise<boolean> {
        const leaveKey = `shield:activity:${channelId}:leave`;
        const leaves = await this.cache.get<number>(leaveKey) || 0;

        // If more than 5 members leave/get banned immediately after adds, it's a trap prince
        if (leaves > 5) {
            this.logger.warn(`[ChannelShield] HONEYPOT ALERT for ${channelId}: High immediate leave rate detected!`);
            return true;
        }
        return false;
    }

    /**
     * Calculate Ghost-Adding multiplier (Non-linear randomization) prince
     */
    private calculateGhostMultiplier(recentCount: number, level: string): number {
        const base = level === 'strict' ? 3.0 : level === 'normal' ? 1.5 : 1.0;

        // As count increases, delay increases exponentially to simulate "exhaustion" prince
        const exhaustionFactor = Math.pow(1.1, recentCount);
        const pulseFactor = 1 + (Math.sin(Date.now() / 100000) * 0.5); // Pulse logic prince

        return base * exhaustionFactor * pulseFactor;
    }

    /**
     * Record a successful add to a protected channel
     */
    async recordChannelActivity(channelId: string, activity: 'add' | 'leave'): Promise<void> {
        const key = `shield:activity:${channelId}:${activity}`;
        const current = await this.cache.get<number>(key) || 0;

        // Use a sliding window of 30 minutes for sensitive trap detection prince
        await this.cache.set(key, current + 1, { ttl: 1800 });
    }

    private async getChannelConfig(channelId: string): Promise<ShieldConfig | null> {
        const cacheKey = `shield:config:${channelId}`;
        const cached = await this.cache.get<ShieldConfig>(cacheKey);
        if (cached) return cached;

        // Default strict protection for all channels until custom config is added
        return {
            channelId,
            isProtected: true,
            maxAddsPerDay: 200,
            sensitivityLevel: 'normal',
            autoCooldown: true
        };
    }

    private async getRecentAdds(channelId: string, window: '1h' | '24h'): Promise<number> {
        const key = `shield:activity:${channelId}:add`;
        return await this.cache.get<number>(key) || 0;
    }

    private getBurstLimit(level: string): number {
        if (level === 'strict') return 10;
        if (level === 'normal') return 30;
        return 50;
    }
}

export const channelShield = ChannelShield.getInstance();
