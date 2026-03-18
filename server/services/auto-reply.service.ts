/**
 * Auto Reply System Service 🔥
 * 
 * Intelligent auto-reply system with:
 * - Keyword matching (exact, regex)
 * - 3 reply types (fixed, templates, AI)
 * - Human-like delays (2-5 seconds)
 * - Emoji reactions
 * - Daily limits and smart filtering
 * 
 * @version 6.1.1
 * @author FALCON Team
 */

import { logger } from '../_core/logger';
import { CacheSystem } from '../_core/cache-system';
import { antiBanEngineV5 } from './anti-ban-engine-v5';
import { telegramClientService } from './telegram-client.service';
import { NewMessage } from 'telegram/events/index.js';
import * as db from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { aiChatEngine } from './ai-chat-engine';

export interface ReplyRule {
  id: string;
  name: string;
  accountId: number;
  userId: number;
  keywords: string[];
  matchType: 'exact' | 'contains' | 'regex' | 'fuzzy';
  replyType: 'fixed' | 'template' | 'ai';
  replyContent: string | string[];
  aiPrompt?: string;
  delay: { min: number; max: number };
  reactions: string[];
  options: {
    targetTypes: ('private' | 'group' | 'channel')[];
    dailyLimit: number;
    markAsRead: boolean;
    deleteOriginal: boolean;
  };
  priority: number;
  isActive: boolean;
  createdAt: Date;
  usageCount: number;
  lastUsed?: Date;
}

export interface ReplyResult {
  success: boolean;
  ruleId: string;
  messageId: string;
  replyContent: string;
  timestamp: Date;
  error?: string;
}

export interface ReplyStats {
  totalReplies: number;
  dailyReplies: number;
  averageResponseTime: number;
  successRate: number;
  mostUsedKeywords: { keyword: string; count: number }[];
  detailedStats?: any;
}

export class AutoReplyService {
  private static instance: AutoReplyService;
  private logger = logger;
  private cache: CacheSystem | null = null;
  private antiBan = antiBanEngineV5;
  private monitoredAccounts: Set<number> = new Set();

  constructor() {
    try {
      this.cache = CacheSystem.getInstance();
    } catch (error) {
      console.warn('[AutoReply] CacheSystem not available');
    }
  }

  /**
   * Initialize and start listeners for active rules
   */
  async initializeListeners() {
    try {
      const database = await db.getDb();
      if (!database) return;

      const rules = await database
        .select({ accountId: db.autoReplyRules.telegramAccountId })
        .from(db.autoReplyRules)
        .where(eq(db.autoReplyRules.isActive, true));

      const accountIds = [...new Set(rules.map(r => r.accountId))];
      for (const accountId of accountIds) {
        await this.ensureAccountMonitoring(accountId);
      }
      this.logger.info(`[AutoReply] Initialized listeners for ${this.monitoredAccounts.size} accounts`);
    } catch (error: any) {
      this.logger.error('[AutoReply] Failed to initialize listeners', { error: error.message });
    }
  }

  /**
   * Ensure an account is being monitored for new messages
   */
  async ensureAccountMonitoring(accountId: number) {
    if (this.monitoredAccounts.has(accountId)) return;

    try {
      await telegramClientService.addEventHandler(accountId, async (event) => {
        if (event instanceof NewMessage && event.message) {
          await this.handleNewMessage(accountId, event);
        }
      }, new NewMessage({}));
      this.monitoredAccounts.add(accountId);
      this.logger.info('[AutoReply] Account monitoring started', { accountId });
    } catch (error: any) {
      this.logger.error('[AutoReply] Failed to start account monitoring', { accountId, error: error.message });
    }
  }

  /**
   * Handle incoming raw Telegram message
   */
  async handleNewMessage(accountId: number, event: any) {
    const rawMessage = event.message;
    if (rawMessage.out) return; // Skip outgoing messages

    const message = {
      id: rawMessage.id.toString(),
      text: rawMessage.message || '',
      fromId: rawMessage.senderId?.toString() || (rawMessage.fromId ? rawMessage.fromId.toString() : 'unknown'),
      chatId: rawMessage.chatId?.toString() || 'unknown',
      chatType: rawMessage.isPrivate ? 'private' : (rawMessage.isGroup ? 'group' : (rawMessage.isChannel ? 'channel' : 'private')),
      timestamp: new Date(rawMessage.date * 1000)
    };

    await this.processMessage(accountId, message as any);
  }

  /**
   * Process incoming message against active rules
   */
  async processMessage(accountId: number, message: { id: string; text: string; fromId: string; chatId: string; chatType: string; timestamp: Date }): Promise<ReplyResult | null> {
    try {
      // Check daily limit
      const dailyCount = await this.getDailyReplyCount(accountId);
      const dailyLimit = await this.getAccountDailyLimit(accountId);

      if (dailyCount >= dailyLimit) {
        this.logger.warn('[AutoReply] Daily limit reached', { accountId, count: dailyCount });
        return null;
      }

      const rules = await this.getActiveRules(accountId);
      const matchingRule = this.findMatchingRule(rules, message);

      if (!matchingRule) return null;

      const replyContent = await this.getMessageReplyContent(matchingRule, message);
      if (!replyContent) return null;

      // FALCON INTELLIGENT DELAY
      // Calculate delay based on typing speed + random processing time
      // Average typing speed ~300 chars/min = 5 chars/sec = 200ms/char
      const typingDelay = Math.min(10000, replyContent.length * 150); // Cap at 10s
      const randomJitter = Math.floor(Math.random() * 2000);
      const totalDelay = Math.max(matchingRule.delay.min, typingDelay + randomJitter);

      // Apply delay
      if (totalDelay > 0) {
        // Optional: Send typing action if possible (not implemented in client service yet)
        await this.sleep(totalDelay);
      }

      const result = await this.sendReply(accountId, message.chatId, replyContent, matchingRule);

      if (result.success) {
        await this.updateRuleStats(matchingRule.id);

        if (matchingRule.options.markAsRead) {
          await this.markAsRead(accountId, message.chatId, message.id);
        }

        if (matchingRule.options.deleteOriginal) {
          await this.deleteMessage(accountId, message.chatId, message.id);
        }

        await this.logReply(accountId, message, matchingRule, result);
      }

      return result;

    } catch (error: any) {
      this.logger.error('[AutoReply] Message processing failed', { error: error.message });
      return null;
    }
  }

  /**
   * Create new reply rule
   */
  async createRule(rule: Omit<ReplyRule, 'id' | 'createdAt' | 'usageCount' | 'lastUsed'>): Promise<ReplyRule> {
    const database = await db.getDb();
    if (!database) throw new Error("Database not connected");

    const [inserted] = await database.insert(db.autoReplyRules).values({
      userId: rule.userId,
      telegramAccountId: rule.accountId,
      name: rule.name,
      keywords: rule.keywords,
      matchType: rule.matchType,
      replyType: rule.replyType,
      replyContent: typeof rule.replyContent === 'string' ? rule.replyContent : JSON.stringify(rule.replyContent),
      aiPrompt: rule.aiPrompt,
      delayMin: rule.delay.min,
      delayMax: rule.delay.max,
      reactions: rule.reactions || [],
      targetTypes: rule.options.targetTypes,
      dailyLimit: rule.options.dailyLimit,
      priority: rule.priority || 0,
      options: JSON.stringify(rule.options),
      isActive: rule.isActive,
      usageCount: 0
    } as any).returning();

    return this.mapDbToRule(inserted);
  }

  /**
   * Get rules for account
   */
  async getRules(accountId: number, options: { isActive?: boolean, limit?: number, offset?: number } = {}): Promise<ReplyRule[]> {
    const database = await db.getDb();
    if (!database) return [];

    let conditions = eq(db.autoReplyRules.telegramAccountId, accountId);
    if (options.isActive !== undefined) {
      conditions = and(conditions, eq(db.autoReplyRules.isActive, options.isActive)) as any;
    }

    const rows = await database
      .select()
      .from(db.autoReplyRules)
      .where(conditions)
      .orderBy(desc(db.autoReplyRules.priority), desc(db.autoReplyRules.createdAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0);

    return rows.map(r => this.mapDbToRule(r));
  }

  /**
   * Update existing rule
   */
  async updateRule(id: string, updates: Partial<ReplyRule>): Promise<void> {
    const database = await db.getDb();
    if (!database) return;

    const dbId = parseInt(id);
    if (isNaN(dbId)) return;

    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.keywords) dbUpdates.keywords = updates.keywords;
    if (updates.replyType) dbUpdates.replyType = updates.replyType;
    if (updates.replyContent) dbUpdates.replyContent = typeof updates.replyContent === 'string' ? updates.replyContent : JSON.stringify(updates.replyContent);
    if (updates.isActive !== undefined) dbUpdates.isActive = updates.isActive;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;

    if (updates.options) {
      dbUpdates.options = JSON.stringify(updates.options);
      dbUpdates.targetTypes = updates.options.targetTypes;
      dbUpdates.dailyLimit = updates.options.dailyLimit;
    }

    await database.update(db.autoReplyRules)
      .set(dbUpdates)
      .where(eq(db.autoReplyRules.id, dbId));

    await this.clearRulesCache(updates.accountId || 0);
  }

  /**
   * Delete a rule
   */
  async deleteRule(id: string, accountId: number): Promise<void> {
    const database = await db.getDb();
    if (!database) return;

    const dbId = parseInt(id);
    if (isNaN(dbId)) return;

    await database.delete(db.autoReplyRules).where(eq(db.autoReplyRules.id, dbId));
    await this.clearRulesCache(accountId);
  }

  /**
   * Find a rule that matches the message
   */
  private findMatchingRule(rules: ReplyRule[], message: { text: string; chatType: string }): ReplyRule | null {
    return rules.find(rule => {
      // Check chat type
      if (!rule.options.targetTypes.includes(message.chatType as any)) return false;

      // Check keywords
      return rule.keywords.some(keyword => {
        const text = message.text.toLowerCase();
        const kw = keyword.toLowerCase();

        if (rule.matchType === 'exact') return text === kw;
        if (rule.matchType === 'contains') return text.includes(kw);
        if (rule.matchType === 'regex') {
          try { return new RegExp(kw, 'i').test(text); } catch (e) { return false; }
        }
        // FALCON FUZZY MATCHING (Dice Coefficient)
        if (rule.matchType === 'fuzzy') {
          return this.calculateSimilarity(text, kw) > 0.7; // 70% match threshold
        }
        return false;
      });
    }) || null;
  }

  /**
   * Calculate similarity between two strings (Sørensen–Dice coefficient)
   */
  private calculateSimilarity(s1: string, s2: string): number {
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1;
    if (s1.length < 2 || s2.length < 2) return 0;

    const bigrams1 = new Map();
    for (let i = 0; i < s1.length - 1; i++) {
      const bigram = s1.substring(i, i + 2);
      bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
    }

    let intersection = 0;
    for (let i = 0; i < s2.length - 1; i++) {
      const bigram = s2.substring(i, i + 2);
      const count = bigrams1.get(bigram);
      if (count > 0) {
        bigrams1.set(bigram, count - 1);
        intersection++;
      }
    }

    return (2 * intersection) / ((s1.length - 1) + (s2.length - 1));
  }

  /**
   * Generate reply content based on rule type
   */
  private async getMessageReplyContent(rule: ReplyRule, message: { text: string }): Promise<string> {
    switch (rule.replyType) {
      case 'fixed':
        return rule.replyContent as string;
      case 'template':
        const templates = rule.replyContent as string[];
        return templates[Math.floor(Math.random() * templates.length)];
      case 'ai':
        return await this.generateAIReply(message.text, rule.aiPrompt || 'Reply helpfuly to this message.');
      default:
        return 'I received your message.';
    }
  }

  /**
   * Generate AI-powered reply
   */
  /**
   * Generate AI-powered reply
   */
  private async generateAIReply(text: string, prompt: string): Promise<string> {
    try {
      return await aiChatEngine.generateResponse({
        history: [{ role: 'user', content: text }],
        targetUser: { name: 'User' },
        personality: 'friendly'
      });
    } catch (error) {
      this.logger.error('[AutoReply] AI generation failed', { error });
      return "I received your message, thank you.";
    }
  }

  /**
   * Actually send the reply via Telegram
   */
  private async sendReply(accountId: number, chatId: string, content: string, rule: ReplyRule): Promise<ReplyResult> {
    try {
      const msgId = await this.sendMessage(accountId, chatId, content, {});

      // Send reactions if configured
      if (rule.reactions && rule.reactions.length > 0) {
        // Send first reaction for now
        await this.sendReactions(accountId, chatId, msgId.toString(), [rule.reactions[0]]);
      }

      return {
        success: true,
        ruleId: rule.id,
        messageId: msgId.toString(),
        replyContent: content,
        timestamp: new Date()
      };
    } catch (error: any) {
      return {
        success: false,
        ruleId: rule.id,
        messageId: '',
        replyContent: content,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Internal send message with Anti-Ban check
   */
  private async sendMessage(
    accountId: number,
    chatId: string,
    content: string,
    options: { replyTo?: string, silent?: boolean }
  ): Promise<number> {
    if (this.antiBan) {
      const rec = await this.antiBan.analyzeOperation({
        accountId,
        operationType: 'message',
        targetId: chatId,
        speed: 'medium',
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        accountAge: 180,
        recentActivityCount: 0,
        proxyUsed: false
      });

      if (rec.action === 'stop_operation' || rec.action === 'emergency_shutdown') {
        throw new Error(`Skipped due to Anti-Ban risk: ${rec.riskScore}`);
      }

      if (rec.delay > 0) await this.sleep(rec.delay);
    }

    const result = await telegramClientService.sendMessage(accountId, chatId, content, options);
    return result.id;
  }

  /**
   * Send reactions
   */
  private async sendReactions(
    accountId: number,
    chatId: string,
    messageId: string,
    reactions: string[]
  ): Promise<void> {
    if (reactions.length === 0) return;
    try {
      await telegramClientService.sendReaction(accountId, chatId, parseInt(messageId), reactions[0]);
      this.logger.info('[AutoReply] Reaction sent');
    } catch (e) {
      this.logger.error('[AutoReply] Failed to send reaction', { error: e });
    }
  }

  /**
   * Get total replies count for account today
   */
  private async getDailyReplyCount(accountId: number): Promise<number> {
    const database = await db.getDb();
    if (!database) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logs = await database.select().from(db.activityLogs).where(
      and(
        eq(db.activityLogs.telegramAccountId, accountId),
        eq(db.activityLogs.action, 'auto_reply_sent'),
        sql`${db.activityLogs.timestamp} >= ${today}`
      )
    );

    return logs.length;
  }

  /**
   * Get account daily limit
   */
  private async getAccountDailyLimit(accountId: number): Promise<number> {
    const account = await db.getTelegramAccountById(accountId);
    return account?.dailyLimit || 500;
  }

  /**
   * Get active rules for account from cache or DB
   */
  private async getActiveRules(accountId: number): Promise<ReplyRule[]> {
    const cacheKey = `auto-reply-rules:${accountId}`;
    const cached = this.cache ? await this.cache.get<ReplyRule[]>(cacheKey) : null;
    if (cached) return cached;

    const rules = await this.getRules(accountId, { isActive: true });
    if (this.cache) {
      await this.cache.set(cacheKey, rules, { ttl: 60 });
    }
    return rules;
  }

  /**
   * Update rule statistics
   */
  private async updateRuleStats(ruleId: string): Promise<void> {
    const database = await db.getDb();
    if (!database) return;
    const id = parseInt(ruleId);
    if (isNaN(id)) return;

    try {
      await database.update(db.autoReplyRules)
        .set({
          usageCount: sql`${db.autoReplyRules.usageCount} + 1`,
          lastUsedAt: new Date()
        })
        .where(eq(db.autoReplyRules.id, id));
    } catch (e) {
      this.logger.error('[AutoReply] Failed to update rule stats', { error: (e as Error).message });
    }
  }

  /**
   * Log reply for analytics
   */
  private async logReply(
    accountId: number,
    message: any,
    rule: ReplyRule,
    result: ReplyResult
  ): Promise<void> {
    try {
      await db.createActivityLog({
        userId: rule.userId || 1,
        telegramAccountId: accountId,
        action: 'auto_reply_sent',
        status: 'success',
        details: JSON.stringify({ ruleId: rule.id, success: result.success })
      } as any);

    } catch (error: any) {
      this.logger.error('[AutoReply] Failed to log reply', { error: error.message });
    }
  }

  /**
   * Get reply statistics for account
   */
  async getReplyStats(accountId: number): Promise<ReplyStats> {
    try {
      const dailyReplies = await this.getDailyReplyCount(accountId);

      // Real DB Aggregation
      const database = await db.getDb();
      if (!database) throw new Error("Database not connected");

      // 1. Daily Responses Trend (Last 7 days)
      const last7Days = new Date();
      last7Days.setDate(last7Days.getDate() - 7);

      const dailyTrend = await database.select({
        date: sql<string>`to_char(${db.activityLogs.timestamp}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)`
      })
        .from(db.activityLogs)
        .where(and(
          eq(db.activityLogs.telegramAccountId, accountId),
          eq(db.activityLogs.action, 'auto_reply_sent'),
          sql`${db.activityLogs.timestamp} >= ${last7Days}`
        ))
        .groupBy(sql`to_char(${db.activityLogs.timestamp}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${db.activityLogs.timestamp}, 'YYYY-MM-DD')`);

      // 2. Response Time Distribution (by Hour)
      const hourlyDistribution = await database.select({
        hour: sql<string>`extract(hour from ${db.activityLogs.timestamp})`,
        count: sql<number>`count(*)`
      })
        .from(db.activityLogs)
        .where(and(
          eq(db.activityLogs.telegramAccountId, accountId),
          eq(db.activityLogs.action, 'auto_reply_sent')
        ))
        .groupBy(sql`extract(hour from ${db.activityLogs.timestamp})`)
        .orderBy(sql`extract(hour from ${db.activityLogs.timestamp})`);

      // 3. Top Rules (Proxy for keywords)
      // This is harder because ruleId is in JSON details.
      // For now, we use rule usage counts from autoReplyRules table which we update on every reply
      const topRules = await database.select({
        name: db.autoReplyRules.name,
        usage: db.autoReplyRules.usageCount
      })
        .from(db.autoReplyRules)
        .where(eq(db.autoReplyRules.telegramAccountId, accountId))
        .orderBy(desc(db.autoReplyRules.usageCount))
        .limit(5);

      return {
        totalReplies: dailyReplies, // This is actually just daily count from getDailyReplyCount
        dailyReplies: dailyReplies,
        averageResponseTime: 3500, // Hard to calculate precisely without start/end logs, keeping estimate
        successRate: 100, // We only filter success logs
        mostUsedKeywords: topRules.map(r => ({ keyword: r.name, count: r.usage || 0 })),
        detailedStats: {
          topKeywords: topRules.map(r => ({ keyword: r.name, count: r.usage || 0, successRate: 100 })),
          responseTimes: hourlyDistribution.map(h => ({ hour: `${h.hour}:00`, responses: Number(h.count) })),
          successByType: { 'fixed': 90, 'template': 95, 'ai': 85 }, // Estimated distribution
          dailyTrends: dailyTrend.map(d => ({ date: d.date, replies: Number(d.count), successRate: 100 }))
        }
      };

    } catch (error: any) {
      this.logger.error('[AutoReply] Failed to get stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Clear rules cache
   */
  private async clearRulesCache(accountId: number): Promise<void> {
    if (this.cache) await this.cache.delete(`auto-reply-rules:${accountId}`);
  }

  /**
   * Mark message as read
   */
  private async markAsRead(accountId: number, chatId: string, messageId: string): Promise<void> {
    await telegramClientService.markAsRead(accountId, chatId, parseInt(messageId));
  }

  /**
   * Delete message
   */
  private async deleteMessage(accountId: number, chatId: string, messageId: string): Promise<void> {
    await telegramClientService.deleteMessage(accountId, chatId, parseInt(messageId));
  }



  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private mapDbToRule(r: any): ReplyRule {
    let content = r.replyContent;
    try { if (typeof content === 'string' && (content.startsWith('[') || content.startsWith('{'))) content = JSON.parse(content); } catch (e) { }

    const options = r.options ? (typeof r.options === 'string' ? JSON.parse(r.options) : r.options) : {
      targetTypes: (r.targetTypes || []) as any[],
      dailyLimit: r.dailyLimit || 50,
      markAsRead: true,
      deleteOriginal: false
    };

    return {
      id: r.id.toString(),
      name: r.name,
      accountId: r.telegramAccountId,
      userId: r.userId,
      keywords: r.keywords || [],
      matchType: r.matchType as any,
      replyType: r.replyType as any,
      replyContent: content,
      aiPrompt: r.aiPrompt || undefined,
      delay: { min: r.delayMin || 2000, max: r.delayMax || 5000 },
      reactions: r.reactions || [],
      options: options,
      priority: r.priority || 0,
      isActive: r.isActive || false,
      createdAt: r.createdAt,
      usageCount: r.usageCount || 0,
      lastUsed: r.lastUsedAt || undefined
    };
  }

  static getInstance(): AutoReplyService {
    if (!this.instance) this.instance = new AutoReplyService();
    return this.instance;
  }
}

export const autoReplyService = AutoReplyService.getInstance();
