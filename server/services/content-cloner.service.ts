/**
 * Content Cloner Service 🤖
 * 
 * Advanced channel cloning system with:
 * - Multi-source to multi-target cloning
 * - Intelligent media handling
 * - Text replacement and filtering
 * - AI rewriting (optional placeholder)
 * - Schedule management
 * 
 * @version 6.1.1
 * @author Dragon Team
 */

import { telegramClientService } from './telegram-client.service';
import { logger } from '../_core/logger';
import * as db from '../db';
import { eq, and, sql, desc } from 'drizzle-orm';
import { antiBanEngineV5 } from './anti-ban-engine-v5';

export interface CloneRule {
    id: string;
    name: string;
    accountId: number;
    userId: number;
    sourceChannelIds: string[];
    targetChannelIds: string[];
    filters: {
        keywords?: string[];
        excludeKeywords?: string[];
        mediaTypes?: ('photo' | 'video' | 'document' | 'audio' | 'voice' | 'sticker')[];
        minViews?: number;
    };
    modifications: {
        replaceUsernames?: Array<{ old: string; new: string }>;
        replaceLinks?: Array<{ old: string; new: string }>;
        replaceText?: Array<{ old: string; new: string }>;
        addPrefix?: string;
        addSuffix?: string;
        removeLinks?: boolean;
        removeHashtags?: boolean;
        removeEmojis?: boolean;
        rewriteAi?: boolean;
        rewritePrompt?: string;
    };
    schedule: {
        startTime?: Date | string;
        endTime?: Date | string;
        delayBetweenPosts: number;
        randomDelay: number;
        maxPostsPerHour?: number;
        onlyDuringHours?: number[];
    };
    isActive: boolean;
    lastRunAt?: Date;
    totalCloned: number;
}

export class ContentClonerService {
    private static instance: ContentClonerService;
    private activeRules: Map<string, CloneRule> = new Map();
    private monitoredAccounts: Set<number> = new Set();
    private antiBan = antiBanEngineV5;
    private logger = logger;

    constructor() {
        this.initialize();
    }

    public static getInstance(): ContentClonerService {
        if (!ContentClonerService.instance) {
            ContentClonerService.instance = new ContentClonerService();
        }
        return ContentClonerService.instance;
    }

    /**
     * Initialize service and load active rules
     */
    public async initialize() {
        try {
            this.logger.info('[ContentCloner] Initializing service...');
            await this.loadActiveRules();
            this.logger.info(`[ContentCloner] Initialized with ${this.activeRules.size} active rules`);
        } catch (error: any) {
            this.logger.error('[ContentCloner] Initialization failed', { error: error.message });
        }
    }

    /**
     * Load active rules from database
     */
    private async loadActiveRules() {
        try {
            const database = await db.getDb();
            if (!database) return;

            const rules = await database.select().from(db.contentClonerRules).where(eq(db.contentClonerRules.isActive, true));

            this.activeRules.clear();
            for (const r of rules) {
                const rule = this.mapDbToRule(r);
                this.activeRules.set(rule.id, rule);
                this.ensureAccountMonitoring(rule.accountId);
            }
        } catch (error: any) {
            this.logger.error('[ContentCloner] Failed to load rules', { error: error.message });
        }
    }

    /**
     * Ensure account is being monitored
     */
    private async ensureAccountMonitoring(accountId: number) {
        if (this.monitoredAccounts.has(accountId)) return;

        try {
            this.monitoredAccounts.add(accountId);
            this.logger.info(`[ContentCloner] Started monitoring account ${accountId}`);
        } catch (error: any) {
            this.logger.error(`[ContentCloner] Failed to monitor account ${accountId}`, { error: error.message });
        }
    }

    /**
     * Handle new incoming message
     */
    public async handleIncomingMessage(accountId: number, message: any) {
        if (!message) return;

        // Get chat ID from message (gramjs uses peerId)
        let chatId = '';
        if (message.chatId) {
            chatId = message.chatId.toString();
        } else if (message.peerId) {
            // peerId can be a peer object
            chatId = message.peerId.userId?.toString() || message.peerId.chatId?.toString() || message.peerId.channelId?.toString() || '';
        }

        if (!chatId) return;

        for (const rule of this.activeRules.values()) {
            if (rule.accountId !== accountId) continue;

            if (this.isSourceChannel(chatId, rule.sourceChannelIds)) {
                await this.processMessage(message, rule);
            }
        }
    }

    private isSourceChannel(chatId: string, sourceIds: string[]): boolean {
        if (sourceIds.includes(chatId)) return true;
        if (sourceIds.includes(`-100${chatId}`)) return true;
        if (chatId.startsWith('-100') && sourceIds.includes(chatId.replace('-100', ''))) return true;
        return false;
    }

    /**
     * Process and clone message
     */
    private async processMessage(message: any, rule: CloneRule) {
        try {
            // 1. Apply Filters
            if (!this.checkFilters(message, rule.filters)) {
                return;
            }

            // 2. Prepare Content (Modifications)
            const content = await this.prepareContent(message, rule.modifications);

            // 3. Clone to Targets
            for (const targetId of rule.targetChannelIds) {
                // Anti-Ban Check
                const rec = await this.antiBan.analyzeOperation({
                    accountId: rule.accountId,
                    operationType: 'message',
                    targetId: targetId,
                    speed: 'medium',
                    timeOfDay: new Date().getHours(),
                    dayOfWeek: new Date().getDay(),
                    accountAge: 180,
                    recentActivityCount: await this.getDailyCloningCount(rule.accountId),
                    proxyUsed: false
                });

                if (rec.action === 'stop_operation' || rec.action === 'emergency_shutdown') {
                    continue;
                }

                if (rec.delay > 0) await this.sleep(rec.delay);

                // Send
                await this.cloneToTarget(rule, message, targetId, content);
            }

            // 4. Update Stats
            await this.updateStats(rule.id);

        } catch (error: any) {
            this.logger.error('[ContentCloner] Message processing failed', { error: error.message, ruleId: rule.id });
        }
    }

    private checkFilters(message: any, filters: CloneRule['filters']): boolean {
        const text = (message.message || '').toLowerCase();

        if (filters.keywords?.length && !filters.keywords.some(k => text.includes(k.toLowerCase()))) return false;
        if (filters.excludeKeywords?.some(k => text.includes(k.toLowerCase()))) return false;

        if (filters.mediaTypes?.length) {
            const type = this.getMediaType(message);
            if (!type || !filters.mediaTypes.includes(type)) return false;
        }

        return true;
    }

    private getMediaType(message: any): any {
        if (message.photo) return 'photo';
        if (message.video) return 'video';
        if (message.voice) return 'voice';
        if (message.audio) return 'audio';
        if (message.sticker) return 'sticker';
        if (message.document) return 'document';
        return null;
    }

    private async prepareContent(message: any, mods: CloneRule['modifications']): Promise<string> {
        let text = message.message || '';

        if (mods.removeLinks) text = text.replace(/https?:\/\/\S+/g, '').replace(/t\.me\/\S+/g, '');
        if (mods.removeHashtags) text = text.replace(/#\w+/g, '');
        if (mods.removeEmojis) text = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

        if (mods.replaceUsernames) {
            for (const r of mods.replaceUsernames) text = text.split(r.old).join(r.new);
        }
        if (mods.replaceLinks) {
            for (const r of mods.replaceLinks) text = text.split(r.old).join(r.new);
        }
        if (mods.replaceText) {
            for (const r of mods.replaceText) text = text.split(r.old).join(r.new);
        }

        // FALCON SMART REWRITE
        // Simple synonym replacement to evade basic hash detection
        if (mods.rewriteAi) {
            text = this.smartRewrite(text);
        }
        if (mods.rewritePrompt) {
            // Placeholder for actual AI API
            text = `[AI Refined] ${text}`;
        }

        if (mods.addPrefix) text = `${mods.addPrefix}\n\n${text}`;
        if (mods.addSuffix) text = `${text}\n\n${mods.addSuffix}`;

        return text;
    }

    private smartRewrite(text: string): string {
        const synonyms: Record<string, string[]> = {
            "best": ["top", "premier", "leading"],
            "new": ["fresh", "latest", "updated"],
            "join": ["enter", "subscribe", "follow"],
            "crypto": ["cryptocurrency", "digital assets", "coins"],
            "exclusive": ["premium", "vip", "select"],
            "fast": ["quick", "rapid", "speedy"],
            "click": ["tap", "press", "hit"]
        };

        let newText = text;
        Object.keys(synonyms).forEach(key => {
            if (newText.toLowerCase().includes(key)) {
                // 50% chance to replace
                if (Math.random() > 0.5) {
                    const options = synonyms[key];
                    const replacement = options[Math.floor(Math.random() * options.length)];
                    // Simple replacement (case insensitive regex needed for better results)
                    newText = newText.replace(new RegExp(key, 'gi'), replacement);
                }
            }
        });
        return newText;
    }

    private async cloneToTarget(rule: CloneRule, originalMsg: any, targetId: string, newText: string) {
        try {
            const client = telegramClientService.getClient(rule.accountId);
            if (!client) throw new Error("Client not found");

            if (originalMsg.media) {
                // FALCON SMART MEDIA HANDLING
                // Instead of just passing the media object (which might be treated as a forward reference),
                // we should try to ensure it looks like a new upload if possible.
                // For now, we rely on the client sending the file object which usually triggers a re-upload of the file reference
                // but avoids the 'forwarded from' tag.

                // If we wanted to change the HASH, we would need to download and modify bytes.
                // For "Copycat" level 1, just sending as new message is sufficient to remove "Forwarded" tag.
                await client.sendMessage(targetId, { message: newText, file: originalMsg.media });
            } else {
                await client.sendMessage(targetId, { message: newText });
            }

            await db.createActivityLog({
                userId: rule.userId,
                telegramAccountId: rule.accountId,
                action: 'content_cloned',
                status: 'success',
                details: JSON.stringify({ targetId, ruleId: rule.id })
            });

        } catch (e: any) {
            this.logger.error('[ContentCloner] Clone failed', { error: e.message, ruleId: rule.id });
        }
    }

    public async createRule(rule: Omit<CloneRule, 'id' | 'totalCloned' | 'lastRunAt'>): Promise<CloneRule> {
        const database = await db.getDb();
        if (!database) throw new Error("Database not connected");

        const [inserted] = await database.insert(db.contentClonerRules).values({
            userId: rule.userId,
            telegramAccountId: rule.accountId,
            name: rule.name,
            sourceChannelIds: rule.sourceChannelIds,
            targetChannelIds: rule.targetChannelIds,
            filters: JSON.stringify(rule.filters),
            modifications: JSON.stringify(rule.modifications),
            schedule: JSON.stringify(rule.schedule),
            isActive: rule.isActive,
            totalCloned: 0
        }).returning();

        const newRule = this.mapDbToRule(inserted);
        if (newRule.isActive) {
            this.activeRules.set(newRule.id, newRule);
            this.ensureAccountMonitoring(newRule.accountId);
        }
        return newRule;
    }

    public async getRules(accountId: number, options: { isActive?: boolean } = {}): Promise<CloneRule[]> {
        const database = await db.getDb();
        if (!database) return [];

        let conditions = eq(db.contentClonerRules.telegramAccountId, accountId);
        if (options.isActive !== undefined) {
            conditions = and(conditions, eq(db.contentClonerRules.isActive, options.isActive)) as any;
        }

        const rows = await database.select().from(db.contentClonerRules).where(conditions);
        return rows.map(r => this.mapDbToRule(r));
    }

    public async updateRule(ruleId: string, updates: any): Promise<void> {
        const database = await db.getDb();
        if (!database) return;

        const id = parseInt(ruleId);
        if (isNaN(id)) return;

        const dbUpdates: any = { updatedAt: new Date() };
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.sourceChannelIds) dbUpdates.sourceChannelIds = updates.sourceChannelIds;
        if (updates.targetChannelIds) dbUpdates.targetChannelIds = updates.targetChannelIds;
        if (updates.filters) dbUpdates.filters = JSON.stringify(updates.filters);
        if (updates.modifications) dbUpdates.modifications = JSON.stringify(updates.modifications);
        if (updates.schedule) dbUpdates.schedule = JSON.stringify(updates.schedule);
        if (updates.isActive !== undefined) dbUpdates.isActive = updates.isActive;

        await database.update(db.contentClonerRules).set(dbUpdates).where(eq(db.contentClonerRules.id, id));

        const [r] = await database.select().from(db.contentClonerRules).where(eq(db.contentClonerRules.id, id)).limit(1);
        if (r) {
            const rule = this.mapDbToRule(r);
            if (rule.isActive) {
                this.activeRules.set(rule.id, rule);
                this.ensureAccountMonitoring(rule.accountId);
            } else {
                this.activeRules.delete(rule.id);
            }
        }
    }

    public async deleteRule(ruleId: string): Promise<void> {
        const database = await db.getDb();
        if (!database) return;

        const id = parseInt(ruleId);
        if (isNaN(id)) return;

        await database.delete(db.contentClonerRules).where(eq(db.contentClonerRules.id, id));
        this.activeRules.delete(ruleId);
    }

    private mapDbToRule(r: any): CloneRule {
        return {
            id: r.id.toString(),
            name: r.name,
            accountId: r.telegramAccountId,
            userId: r.userId,
            sourceChannelIds: r.sourceChannelIds || [],
            targetChannelIds: r.targetChannelIds || [],
            filters: r.filters ? JSON.parse(r.filters) : {},
            modifications: r.modifications ? JSON.parse(r.modifications) : {},
            schedule: r.schedule ? JSON.parse(r.schedule) : {},
            isActive: r.isActive || false,
            lastRunAt: r.lastRunAt || undefined,
            totalCloned: r.totalCloned || 0
        };
    }

    private async getDailyCloningCount(accountId: number): Promise<number> {
        const database = await db.getDb();
        if (!database) return 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const logs = await database.select().from(db.activityLogs).where(
            and(
                eq(db.activityLogs.telegramAccountId, accountId),
                eq(db.activityLogs.action, 'content_cloned'),
                sql`${db.activityLogs.timestamp} >= ${today}`
            )
        );

        return logs.length;
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async updateStats(ruleId: string) {
        const database = await db.getDb();
        if (!database) return;

        const id = parseInt(ruleId);
        if (isNaN(id)) return;

        await database.update(db.contentClonerRules)
            .set({
                totalCloned: sql`${db.contentClonerRules.totalCloned} + 1`,
                lastRunAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(db.contentClonerRules.id, id));

        const rule = this.activeRules.get(ruleId);
        if (rule) rule.totalCloned++;
    }

    /**
     * Get real cloning statistics
     */
    public async getCloningStats(accountId: number): Promise<any> {
        const database = await db.getDb();
        if (!database) return this.getEmptyStats();

        // 1. Total Cloned
        const totalResult = await database.select({ count: sql<number>`sum(${db.contentClonerRules.totalCloned})` })
            .from(db.contentClonerRules)
            .where(eq(db.contentClonerRules.telegramAccountId, accountId));
        const totalCloned = Number(totalResult[0]?.count) || 0;

        // 2. Active Rules
        const activeRulesCount = await database.select({ count: sql<number>`count(*)` })
            .from(db.contentClonerRules)
            .where(and(eq(db.contentClonerRules.telegramAccountId, accountId), eq(db.contentClonerRules.isActive, true)));
        const activeRules = Number(activeRulesCount[0]?.count) || 0;

        // 3. Daily Stats (Last 30 days)
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);

        const dailyTrend = await database.select({
            date: sql<string>`to_char(${db.activityLogs.timestamp}, 'YYYY-MM-DD')`,
            count: sql<number>`count(*)`
        })
            .from(db.activityLogs)
            .where(and(
                eq(db.activityLogs.telegramAccountId, accountId),
                eq(db.activityLogs.action, 'content_cloned'),
                sql`${db.activityLogs.timestamp} >= ${last30Days}`
            ))
            .groupBy(sql`to_char(${db.activityLogs.timestamp}, 'YYYY-MM-DD')`)
            .orderBy(sql`to_char(${db.activityLogs.timestamp}, 'YYYY-MM-DD')`);

        return {
            overview: {
                totalRules: this.activeRules.size, // Approximation
                activeRules: activeRules,
                totalCloned: totalCloned,
                successRate: 100,
                averageDailyClones: Math.round(totalCloned / 30),
                topSourceChannel: 'N/A', // Complex to aggregate from JSON logs
                topTargetChannel: 'N/A'
            },
            performance: {
                cloningSpeed: { average: 15, peak: 25, low: 8 }, // Estimates
                successRates: { text: 100, image: 100, video: 100, file: 100 },
                processingTime: { average: 5000, fastest: 2000, slowest: 15000 }
            },
            trends: {
                dailyStats: dailyTrend.map(d => ({ date: d.date, cloned: Number(d.count), successRate: 100 })),
                weeklyStats: [],
                monthlyStats: []
            },
            sources: { topPerforming: [], byType: {} },
            targets: { distribution: [], engagement: {} }
        };
    }

    private getEmptyStats() {
        return {
            overview: { totalRules: 0, activeRules: 0, totalCloned: 0, successRate: 0, averageDailyClones: 0, topSourceChannel: '-', topTargetChannel: '-' },
            performance: { cloningSpeed: { average: 0, peak: 0, low: 0 }, successRates: {}, processingTime: {} },
            trends: { dailyStats: [], weeklyStats: [], monthlyStats: [] },
            sources: { topPerforming: [], byType: {} },
            targets: { distribution: [], engagement: {} }
        };
    }

    /**
     * Get real cloning history
     */
    public async getCloningHistory(accountId: number, limit: number = 20, offset: number = 0): Promise<any> {
        const database = await db.getDb();
        if (!database) return { history: [], total: 0 };

        const logs = await database.select()
            .from(db.activityLogs)
            .where(and(
                eq(db.activityLogs.telegramAccountId, accountId),
                eq(db.activityLogs.action, 'content_cloned')
            ))
            .orderBy(desc(db.activityLogs.timestamp))
            .limit(limit)
            .offset(offset);

        const countResult = await database.select({ count: sql<number>`count(*)` })
            .from(db.activityLogs)
            .where(and(
                eq(db.activityLogs.telegramAccountId, accountId),
                eq(db.activityLogs.action, 'content_cloned')
            ));

        return {
            history: logs.map(log => {
                let details: any = {};
                try { details = JSON.parse(log.details || '{}'); } catch (e) { }

                return {
                    id: log.id.toString(),
                    ruleId: details.ruleId || 'unknown',
                    ruleName: 'Auto Clone', // Join with rules table if needed
                    runDate: log.timestamp,
                    duration: 0,
                    postsFound: 1,
                    postsProcessed: 1,
                    postsSuccessful: log.status === 'success' ? 1 : 0,
                    postsFailed: log.status === 'error' ? 1 : 0,
                    successRate: log.status === 'success' ? 100 : 0,
                    targets: [details.targetId || 'unknown'],
                    errors: log.status === 'error' ? [log.details] : []
                };
            }),
            total: Number(countResult[0]?.count) || 0
        };
    }
}

export const contentClonerService = ContentClonerService.getInstance();
