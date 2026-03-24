// Database connection and utilities
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Secrets } from "./_core/secrets";
import { encryptString, decryptString } from "./_core/crypto";
import { logger } from "./_core/logger";
import { and, eq, like, gte, lte, desc, asc, sql } from "drizzle-orm";
export { and, eq, like, gte, lte, desc, asc, sql };
import {
  users,
  telegramAccounts,
  extractedMembers,
  bulkOperations,
  activityLogs,
  statistics,
  antiBanRules,
  proxyConfigs,
} from "./db/schema";

export * from "./db/schema";

import type {
  InsertUser,
  InsertTelegramAccount,
  InsertExtractedMember,
  InsertBulkOperation,
  InsertActivityLog,
} from "./db/schema";

export interface MappedOperationResult {
  id: number;
  userId: number;
  telegramAccountId: number | null;
  action: string;
  status: string;
  timestamp: Date;
  success: boolean;
  duration?: number;
  actualDelay?: number;
  responseTime?: number;
  proxyUsed?: number;
  errorType?: string;
  errorMessage?: string;
  targetCount?: number;
}

export interface MappedRateLimit {
  id: number;
  userId: number;
  date: Date;
  messagesSent: number | null;
  membersAdded: number | null;
  operationsCompleted: number | null;
  errors: number | null;
  createdAt: Date;
  count: number;
}

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

import * as schemaExports from "./db/schema";

/**
 * Get or create database connection
 */
export async function getDb() {
  const url = Secrets.getDatabaseUrl();
  if (!_db && url) {
    try {
      _client = postgres(url, { max: 20 });
      _db = drizzle(_client, { schema: schemaExports });
      logger.info("[Database] Connected successfully to PostgreSQL:", url.replace(/\/\/.*@/, '//***@'));
    } catch (error: any) {
      if (error.code === '28P01') {
        logger.error("[Database] AUTHENTICATION FAILED: The password for your database is incorrect. Please check DATABASE_URL in Render dashboard.");
      } else {
        logger.warn("[Database] Failed to connect:", error.message || error);
      }
      _db = null;
      _client = null;
    }
  }
  return _db;
}

/**
 * Close database connection
 */
export async function closeDb() {
  if (_client) {
    await _client.end();
    _db = null;
    _client = null;
    logger.info("[Database] Connection closed");
  }
}

// Create a proxy for backward compatibility
export const db = new Proxy({}, {
  get(target, prop) {
    if (!_db) {
      throw new Error('Database not initialized. Use getDb() to get database instance.');
    }
    return (_db as any)[prop];
  }
}) as any;

/**
 * Database helper functions
 */

// Users
export async function createUser(data: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.insert(users).values(data).returning();
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] || null;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

export async function getActiveAccountsCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(telegramAccounts).where(eq(telegramAccounts.isActive, true));
  return Number(result[0]?.count) || 0;
}

export async function getOperationsCountToday(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result = await db.select({ count: sql<number>`count(*)` }).from(activityLogs).where(gte(activityLogs.timestamp, today));
  return Number(result[0]?.count) || 0;
}

// Telegram Accounts
export async function createTelegramAccount(data: InsertTelegramAccount) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");

  // Encrypt session string before storing
  const encryptedData = {
    ...data,
    sessionString: encryptString(data.sessionString),
  };

  return db.insert(telegramAccounts).values(encryptedData).returning();
}

export async function getTelegramAccountsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const accounts = await db.select().from(telegramAccounts).where(eq(telegramAccounts.userId, userId));

  // Decrypt session strings
  return accounts.map(account => ({
    ...account,
    sessionString: decryptString(account.sessionString),
  }));
}

export async function getTelegramAccountById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(telegramAccounts).where(eq(telegramAccounts.id, id)).limit(1);

  if (result.length > 0) {
    return {
      ...result[0],
      sessionString: decryptString(result[0].sessionString),
      apiId: result[0].apiId,
      apiHash: result[0].apiHash,
    };
  }
  return null;
}

export async function updateTelegramAccount(id: number, data: Partial<InsertTelegramAccount>) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");

  // Encrypt session string if provided
  const updateData = data.sessionString
    ? { ...data, sessionString: encryptString(data.sessionString) }
    : data;

  return db.update(telegramAccounts).set(updateData).where(eq(telegramAccounts.id, id)).returning();
}

export async function deleteTelegramAccount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.delete(telegramAccounts).where(eq(telegramAccounts.id, id));
}

// Extracted Members
export async function createExtractedMembers(members: InsertExtractedMember[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.insert(extractedMembers).values(members).returning();
}

export async function getExtractedMembersByAccountAndGroup(userId: number, groupId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.select().from(extractedMembers).where(
    and(eq(extractedMembers.userId, userId), eq(extractedMembers.sourceGroupId, groupId))
  );
}

export async function getExtractedMembersByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.select().from(extractedMembers).where(eq(extractedMembers.userId, userId));
}

// Bulk Operations
export async function createBulkOperation(data: InsertBulkOperation) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(bulkOperations).values(data).returning();
  return result[0];
}

export async function getBulkOperationsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.select().from(bulkOperations).where(eq(bulkOperations.userId, userId));
}

export async function getBulkOperationById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.select().from(bulkOperations).where(eq(bulkOperations.id, id)).limit(1);
}

export async function updateBulkOperation(id: number, data: Partial<InsertBulkOperation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.update(bulkOperations).set(data).where(eq(bulkOperations.id, id)).returning();
  return result[0];
}

// Activity Logs
export async function createActivityLog(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.insert(activityLogs).values(data).returning();
}

export async function getActivityLogsByUserId(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.select().from(activityLogs).where(eq(activityLogs.userId, userId)).limit(limit);
}

// Statistics
export async function getStatisticsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.select().from(statistics).where(eq(statistics.userId, userId));
}

export async function getStatisticsByDate(userId: number, date: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.select().from(statistics).where(
    and(eq(statistics.userId, userId), eq(statistics.date, new Date(date)))
  ).limit(1);
}

// Anti-Ban Rules
export async function getAntiBanRules(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(antiBanRules).where(eq(antiBanRules.userId, userId)).limit(1);
  return result[0] || null;
}

export async function createAntiBanRules(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.insert(antiBanRules).values(data).returning();
}

// Rate Limiting Tracking (using statistics table)
export async function getRateLimitTracking(userId: number, actionType: string): Promise<MappedRateLimit | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result = await db.select().from(statistics).where(
    and(eq(statistics.userId, userId), gte(statistics.date, today))
  ).limit(1);
  if (result.length > 0) {
    return {
      ...result[0],
      count: result[0].messagesSent || 0
    } as MappedRateLimit;
  }
  return null;
}

export async function createRateLimitTracking(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.insert(statistics).values({
    userId: data.userId || data.accountId,
    date: new Date(),
    messagesSent: data.count,
  }).returning();
}

export async function updateRateLimitTracking(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.update(statistics).set({
    messagesSent: data.count,
  }).where(eq(statistics.id, id)).returning();
}

// Proxy Configs
export async function getAllProxyConfigs() {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.select().from(proxyConfigs);
}

export async function getProxyConfigsByAccountId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.select().from(proxyConfigs).where(eq(proxyConfigs.userId, userId));
}

export async function getProxyConfig(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(proxyConfigs).where(eq(proxyConfigs.id, id)).limit(1);
  return result[0] || null;
}

export async function updateProxyConfig(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.update(proxyConfigs).set({
    ...data,
    updatedAt: new Date()
  }).where(eq(proxyConfigs.id, id)).returning();
}

export async function getActiveProxyConfigs() {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.select().from(proxyConfigs).where(eq(proxyConfigs.health, 'healthy'));
}

export async function createProxyConfig(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.insert(proxyConfigs).values(data).returning();
}

// Operation Results (using activityLogs table)
export async function createOperationResult(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.insert(activityLogs).values({
    userId: data.userId || data.accountId,
    action: data.operationType || data.action,
    status: data.success ? 'success' : 'error',
    details: JSON.stringify(data),
    timestamp: new Date(),
  }).returning();
}

export async function getOperationResults(userId: number, since: Date): Promise<MappedOperationResult[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const results = await db.select().from(activityLogs).where(
    and(eq(activityLogs.userId, userId), gte(activityLogs.timestamp, since))
  ).orderBy(desc(activityLogs.timestamp));

  return results.map(row => {
    let details = {};
    try {
      details = row.details ? JSON.parse(row.details) : {};
    } catch (e) {
      logger.error("Failed to parse activity log details:", e);
    }
    return {
      ...row,
      ...details,
      success: row.status === 'success'
    } as MappedOperationResult;
  });
}

export async function getRecentOperationResults(limit: number): Promise<MappedOperationResult[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const results = await db.select().from(activityLogs).orderBy(desc(activityLogs.timestamp)).limit(limit);
  return results.map(row => {
    let details = {};
    try {
      details = row.details ? JSON.parse(row.details) : {};
    } catch (e) {
      logger.error("Failed to parse activity log details:", e);
    }
    return {
      ...row,
      ...details,
      success: row.status === 'success'
    } as MappedOperationResult;
  });
}

export async function deleteOldOperationResults(cutoff: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.delete(activityLogs).where(lte(activityLogs.timestamp, cutoff));
}

export async function deleteOldRateLimitTracking(cutoff: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.delete(statistics).where(lte(statistics.date, cutoff));
}

export async function getAllTelegramAccounts() {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  return db.select().from(telegramAccounts);
}

export async function getTelegramAccount(id: number) {
  return getTelegramAccountById(id);
}

// Compatibility Aliases
export const getProxyConfigsByUserId = getProxyConfigsByAccountId;
export const getActivityLogsByAccountId = getActivityLogsByUserId;
export const getBulkOperationsByAccountId = (userId: number) => getBulkOperationsByUserId(userId);

export async function upsertUser(data: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");

  const existing = await getUserByEmail(data.email);
  if (existing) {
    return db.update(users).set(data).where(eq(users.email, data.email)).returning();
  }
  return db.insert(users).values(data).returning();
}

/**
 * Increment statistics counters for a user on a given date.
 * Creates the row if it doesn't exist, then atomically increments the specified fields.
 */
export async function updateStatistics(
  userId: number,
  date: string,
  increments: {
    messagesSent?: number;
    membersAdded?: number;
    operationsCompleted?: number;
    errors?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Find existing row for this user+date
  const existing = await db.select().from(statistics).where(
    and(
      eq(statistics.userId, userId),
      gte(statistics.date, targetDate),
      lte(statistics.date, nextDay)
    )
  ).limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    await db.update(statistics).set({
      messagesSent: (row.messagesSent ?? 0) + (increments.messagesSent ?? 0),
      membersAdded: (row.membersAdded ?? 0) + (increments.membersAdded ?? 0),
      operationsCompleted: (row.operationsCompleted ?? 0) + (increments.operationsCompleted ?? 0),
      errors: (row.errors ?? 0) + (increments.errors ?? 0),
    }).where(eq(statistics.id, row.id));
  } else {
    await db.insert(statistics).values({
      userId,
      date: targetDate,
      messagesSent: increments.messagesSent ?? 0,
      membersAdded: increments.membersAdded ?? 0,
      operationsCompleted: increments.operationsCompleted ?? 0,
      errors: increments.errors ?? 0,
    });
  }
}

export async function getOrCreateStatistics(userId: number, date: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Try to find existing statistics for this date
  const existing = await db.select().from(statistics).where(
    and(
      eq(statistics.userId, userId),
      gte(statistics.date, targetDate),
      lte(statistics.date, nextDay)
    )
  ).limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    return {
      id: row.id,
      date: row.date,
      messagesSent: row.messagesSent ?? 0,
      messagesFailed: row.errors ?? 0,
      membersExtracted: row.operationsCompleted ?? 0,
      groupsJoined: 0,
      groupsLeft: 0,
      usersAdded: row.membersAdded ?? 0,
      successRate: row.messagesSent
        ? Math.round(((row.messagesSent - (row.errors ?? 0)) / row.messagesSent) * 100)
        : 0,
    };
  }

  // Create new statistics entry for this date
  const [created] = await db.insert(statistics).values({
    userId,
    date: targetDate,
    messagesSent: 0,
    membersAdded: 0,
    operationsCompleted: 0,
    errors: 0,
  }).returning();

  return {
    id: created.id,
    date: created.date,
    messagesSent: 0,
    messagesFailed: 0,
    membersExtracted: 0,
    groupsJoined: 0,
    groupsLeft: 0,
    usersAdded: 0,
    successRate: 0,
  };
}

