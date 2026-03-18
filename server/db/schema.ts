import { pgTable, serial, integer, varchar, text, boolean, timestamp, decimal } from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Licenses table
export const licenses = pgTable('licenses', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  licenseKey: varchar('licenseKey', { length: 255 }).notNull().unique(),
  type: varchar('type', { length: 50 }).notNull(), // trial, basic, premium, enterprise
  status: varchar('status', { length: 50 }).notNull().default('inactive'), // active, inactive, expired, suspended
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  activatedAt: timestamp('activatedAt'),
  expiresAt: timestamp('expiresAt'),
  maxAccounts: integer('maxAccounts').notNull().default(1),
  maxMessages: integer('maxMessages').notNull().default(1000),
  features: text('features').array().notNull().default([]),
  hardwareId: varchar('hardwareId', { length: 255 }),
  lastValidated: timestamp('lastValidated'),
  usageCount: integer('usageCount').notNull().default(0),
  maxUsage: integer('maxUsage'),
  autoRenew: boolean('autoRenew').notNull().default(false),
  renewalPrice: decimal('renewalPrice', { precision: 10, scale: 2 }),
});

// Subscriptions table
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  licenseId: integer('licenseId').notNull().references(() => licenses.id, { onDelete: 'cascade' }),
  plan: varchar('plan', { length: 50 }).notNull(), // monthly, quarterly, yearly, lifetime
  status: varchar('status', { length: 50 }).notNull().default('inactive'), // active, inactive, cancelled, expired
  startDate: timestamp('startDate').notNull(),
  endDate: timestamp('endDate').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  autoRenew: boolean('autoRenew').notNull().default(true),
  nextBillingDate: timestamp('nextBillingDate'),
  paymentMethod: varchar('paymentMethod', { length: 100 }),
  paymentId: varchar('paymentId', { length: 255 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// License usage logs
export const licenseUsageLogs = pgTable('license_usage_logs', {
  id: serial('id').primaryKey(),
  licenseId: integer('licenseId').notNull().references(() => licenses.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 100 }).notNull(),
  metadata: text('metadata'), // JSON string
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Telegram accounts table (existing)
export const telegramAccounts = pgTable('telegram_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull().unique(),
  telegramId: varchar('telegram_id', { length: 50 }).unique(),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  username: varchar('username', { length: 255 }),
  sessionString: text('session_string').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isRestricted: boolean('is_restricted').default(false).notNull(),
  restrictionReason: text('restriction_reason'),
  warmingLevel: integer('warming_level').default(0).notNull(),
  messagesSentToday: integer('messages_sent_today').default(0).notNull(),
  dailyLimit: integer('daily_limit').default(100).notNull(),
  lastActivityAt: timestamp('last_activity_at'),
  lastRestrictedAt: timestamp('last_restricted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Extracted members table (existing)
export const extractedMembers = pgTable('extracted_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  telegramAccountId: integer('telegram_account_id').notNull().references(() => telegramAccounts.id, { onDelete: 'cascade' }),
  sourceGroupId: varchar('source_group_id', { length: 255 }).notNull(),
  memberTelegramId: varchar('member_telegram_id', { length: 50 }).notNull(),
  memberUsername: varchar('member_username', { length: 255 }),
  memberFirstName: varchar('member_first_name', { length: 255 }),
  memberLastName: varchar('member_last_name', { length: 255 }),
  memberPhone: varchar('member_phone', { length: 20 }),
  extractionDate: timestamp('extraction_date').defaultNow().notNull(),
  isAdded: boolean('is_added').default(false).notNull(),
  addedDate: timestamp('added_date'),
});

// Bulk operations table (existing)
export const bulkOperations = pgTable('bulk_operations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  operationType: varchar('operation_type', { length: 50 }).notNull(), // add_members, send_message, etc.
  sourceGroupId: varchar('source_group_id', { length: 255 }),
  targetGroupId: varchar('target_group_id', { length: 255 }),
  messageContent: text('message_content'),
  delayBetweenMessages: integer('delay_between_messages').default(1000),
  totalMembers: integer('total_members').default(0),
  processedMembers: integer('processed_members').default(0),
  successfulMembers: integer('successful_members').default(0),
  failedMembers: integer('failed_members').default(0),
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, running, completed, failed, paused
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Activity logs table (existing)
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  telegramAccountId: integer('telegramAccountId').references(() => telegramAccounts.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  details: text('details'),
  status: varchar('status', { length: 50 }).notNull(), // success, error, warning
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Statistics table (existing)
export const statistics = pgTable('statistics', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: timestamp('date').notNull(),
  messagesSent: integer('messages_sent').default(0),
  membersAdded: integer('members_added').default(0),
  operationsCompleted: integer('operations_completed').default(0),
  errors: integer('errors').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Anti-ban rules table (existing)
export const antiBanRules = pgTable('anti_ban_rules', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  telegramAccountId: integer('telegram_account_id').references(() => telegramAccounts.id, { onDelete: 'cascade' }),
  ruleName: varchar('rule_name', { length: 255 }).notNull(),
  ruleType: varchar('rule_type', { length: 50 }).notNull(), // rate_limit, delay_pattern, content_filter, etc.
  ruleConfig: text('rule_config').notNull(), // JSON string
  isActive: boolean('is_active').default(true).notNull(),
  priority: integer('priority').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Proxy configurations
export const proxyConfigs = pgTable('proxy_configs', {
  id: serial('id').primaryKey(),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  telegramAccountId: integer('telegramAccountId').references(() => telegramAccounts.id, { onDelete: 'set null' }),
  host: varchar('host', { length: 255 }).notNull(),
  port: integer('port').notNull(),
  username: varchar('username', { length: 100 }),
  password: varchar('password', { length: 100 }),
  type: varchar('type', { length: 20 }).notNull().default('http'), // http, socks5
  health: varchar('health', { length: 20 }).notNull().default('unknown'), // active, dead, slow
  lastCheckedAt: timestamp('lastCheckedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Auto-reply rules table
export const autoReplyRules = pgTable('auto_reply_rules', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  telegramAccountId: integer('telegram_account_id').notNull().references(() => telegramAccounts.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  keywords: text('keywords').array().notNull(),
  matchType: varchar('match_type', { length: 20 }).notNull(), // exact, contains, regex
  replyType: varchar('reply_type', { length: 20 }).notNull(), // fixed, template, ai
  replyContent: text('reply_content').notNull(), // JSON for arrays
  aiPrompt: text('ai_prompt'),
  delayMin: integer('delay_min').default(2000),
  delayMax: integer('delay_max').default(5000),
  reactions: text('reactions').array(),
  targetTypes: text('target_types').array().notNull(), // private, group, channel
  dailyLimit: integer('daily_limit').default(50),
  priority: integer('priority').default(0),
  options: text('options'), // JSON for extra settings
  isActive: boolean('is_active').default(true),
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Content Cloner rules table
export const contentClonerRules = pgTable('content_cloner_rules', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  telegramAccountId: integer('telegram_account_id').notNull().references(() => telegramAccounts.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  sourceChannelIds: text('source_channel_ids').array().notNull(),
  targetChannelIds: text('target_channel_ids').array().notNull(),
  filters: text('filters').notNull(), // JSON: mediaType, keywords, etc.
  modifications: text('modifications').notNull(), // JSON: replace, remove, etc.
  schedule: text('schedule'), // JSON: delays, active hours
  isActive: boolean('is_active').default(true),
  lastRunAt: timestamp('last_run_at'),
  totalCloned: integer('total_cloned').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Export all tables
export const schema = {
  users,
  licenses,
  subscriptions,
  licenseUsageLogs,
  telegramAccounts,
  extractedMembers,
  bulkOperations,
  activityLogs,
  statistics,
  antiBanRules,
  proxyConfigs,
  autoReplyRules,
  contentClonerRules,
};

// Type Inferences
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type TelegramAccount = typeof telegramAccounts.$inferSelect;
export type InsertTelegramAccount = typeof telegramAccounts.$inferInsert;
export type ExtractedMember = typeof extractedMembers.$inferSelect;
export type InsertExtractedMember = typeof extractedMembers.$inferInsert;
export type BulkOperation = typeof bulkOperations.$inferSelect;
export type InsertBulkOperation = typeof bulkOperations.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;
export type Statistic = typeof statistics.$inferSelect;
export type InsertStatistic = typeof statistics.$inferInsert;
export type AntiBanRule = typeof antiBanRules.$inferSelect;
export type InsertAntiBanRule = typeof antiBanRules.$inferInsert;
export type ProxyConfig = typeof proxyConfigs.$inferSelect;
export type InsertProxyConfig = typeof proxyConfigs.$inferInsert;
export type AutoReplyRule = typeof autoReplyRules.$inferSelect;
export type InsertAutoReplyRule = typeof autoReplyRules.$inferInsert;
export type ContentClonerRule = typeof contentClonerRules.$inferSelect;
export type InsertContentClonerRule = typeof contentClonerRules.$inferInsert;
