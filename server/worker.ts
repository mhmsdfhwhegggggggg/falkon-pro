/**
 * Industrial Worker System v4.0.0 - ULTIMATE SCALE
 * 
 * High-performance background worker using BullMQ:
 * - Massive Parallelism: Optimized for high concurrency.
 * - Memory Efficient: Streaming extraction and batch processing.
 * - Fault Tolerant: Auto-recovery and exponential backoff on RPC errors.
 * - Real-time Sync: Instant progress updates to DB and Redis.
 */

import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { ENV } from "./_core/env";
import { createLogger } from "./_core/logger";
import { TelegramClientService, telegramClientService } from "./services/telegram-client.service";
import { industrialExtractor } from "./services/industrial-extractor";
import { highSpeedAdder } from "./services/high-speed-adder";
import * as db from "./db";
import type {
  JobType,
  SendBulkMessagesPayload,
  JoinGroupsPayload,
  ExtractAndAddPayload,
} from "./_core/queue";

const logger = createLogger('Worker');

const connection = new IORedis(ENV.redisUrl);
const tg = new TelegramClientService();

const worker = new Worker(
  "bulkOps",
  async (job: Job) => {
    const type = job.name as JobType;
    logger.info(`Processing job ${job.id} (${type})`);

    try {
      if (type === "extract-and-add") {
        return await handleExtractAndAdd(job);
      }
      if (type === "send-bulk-messages") {
        return await handleBulkMessages(job);
      }
      if (type === "join-groups") {
        return await handleJoinGroups(job);
      }
      if (type === "send-login-codes") {
        return await handleSendLoginCodes(job);
      }
      if (type === "confirm-login-codes") {
        return await handleConfirmLoginCodes(job);
      }
    } catch (error: any) {
      logger.error(`Job ${job.id} failed: ${error.message}`);
      throw error;
    }
  },
  {
    connection,
    concurrency: 50, // Industrial scale concurrency
    limiter: { max: 1000, duration: 1000 }
  }
);

async function handleExtractAndAdd(job: Job) {
  const p = job.data as ExtractAndAddPayload;
  const account = await db.getTelegramAccountById(p.accountId);
  if (!account) throw new Error("Account not found");

  // 1. Initialize Industrial Operation
  const bulkOp = await db.createBulkOperation({
    userId: p.accountId,
    operationType: "extract-and-add",
    status: "running",
    totalMembers: 0,
    delayBetweenMessages: p.delayMs,
    config: JSON.stringify(p),
  } as any);

  const credentials = tg.getApiCredentials();
  const client = await tg.initializeClient(
    p.accountId,
    account.phoneNumber,
    account.sessionString,
    credentials.apiId,
    credentials.apiHash,
  );

  let extractedCount = 0;
  let success = 0;
  let failed = 0;
  const toAdd: any[] = [];

  // 2. Industrial Extraction (Streaming)
  await industrialExtractor.industrialExtract(
    client,
    p.accountId,
    p.source,
    {
      limit: p.limit,
      hasUsername: p.requireUsername,
      activityDays: p.daysActive
    },
    async (batch) => {
      toAdd.push(...batch);
      extractedCount += batch.length;
      await job.updateProgress(Math.min(20, Math.floor((extractedCount / (p.limit || 1000)) * 20)));
    }
  );

  const operations = await db.getBulkOperationsByAccountId(p.accountId);
  const operation = operations[0];

  if (operation) {
    await db.updateBulkOperation(operation.id, {
      totalMembers: toAdd.length,
      processedMembers: toAdd.length
    } as any);
  }

  // 3. High-Speed Addition
  for (let i = 0; i < toAdd.length; i++) {
    const user = toAdd[i];
    const res = await highSpeedAdder.addUser(client, p.accountId, p.target, user.id);

    if (res.success) success++; else failed++;

    // Progress: 20% to 100%
    const progress = 20 + Math.floor(((i + 1) / toAdd.length) * 80);
    await job.updateProgress(progress);

    // Dynamic Delay with Jitter
    const delay = res.waitMs || p.delayMs || 2000;
    await new Promise(r => setTimeout(r, delay + Math.random() * 500));
  }

  // 4. Finalize
  if (operation) {
    await db.updateBulkOperation(operation.id, {
      status: "completed",
      successfulMembers: success,
      failedMembers: failed,
      completedAt: new Date(),
    } as any);
  }

  return { extracted: extractedCount, success, failed };
}

// Simplified handlers for other types...
/**
 * Send login codes to many phone numbers
 */
async function handleSendLoginCodes(job: Job) {
  const { phoneNumbers } = job.data;
  let progress = 0;
  
  for (const phoneNumber of phoneNumbers) {
    try {
      logger.info(`Sending code to ${phoneNumber}...`);
      const credentials = telegramClientService.getApiCredentials();
      const client = new TelegramClient(new StringSession(""), credentials.apiId, credentials.apiHash, {
        connectionRetries: 5,
      });
      await client.connect();
      await client.sendCode(credentials, phoneNumber);
      await client.disconnect();
    } catch (error: any) {
      logger.error(`Failed to send code to ${phoneNumber}: ${error.message}`);
    }
    
    progress += 100 / phoneNumbers.length;
    await job.updateProgress(Math.floor(progress));
  }
}

/**
 * Confirm login codes and create sessions
 */
async function handleConfirmLoginCodes(job: Job) {
  const { userId, items } = job.data;
  let progress = 0;
  
  for (const item of items) {
    try {
      logger.info(`Confirming code for ${item.phoneNumber}...`);
      const defaultCreds = telegramClientService.getApiCredentials();
      const credentials = {
        apiId: item.apiId || defaultCreds.apiId,
        apiHash: item.apiHash || defaultCreds.apiHash
      };
      
      const client = new TelegramClient(new StringSession(""), credentials.apiId, credentials.apiHash, {
        connectionRetries: 5,
      });
      
      await client.connect();
      await client.start({
        phoneNumber: item.phoneNumber,
        phoneCode: async () => item.code,
        password: async () => item.password || "",
        onError: (err: any) => { throw err; }
      });
      
      const sessionString = client.session.save() as any;
      const me = await client.getMe() as any;
      
      // Create account in DB
      await db.createTelegramAccount({
        userId,
        phoneNumber: item.phoneNumber,
        sessionString: sessionString,
        telegramId: me.id.toString(),
        firstName: me.firstName,
        lastName: me.lastName,
        username: me.username,
        apiId: credentials.apiId,
        apiHash: credentials.apiHash,
        isActive: true,
        warmingLevel: 0,
        messagesSentToday: 0,
        dailyLimit: 100,
      } as any);
      
      await client.disconnect();
    } catch (error: any) {
      logger.error(`Failed to confirm ${item.phoneNumber}: ${error.message}`);
    }
    
    progress += 100 / items.length;
    await job.updateProgress(Math.floor(progress));
  }
}

/**
 * Send bulk messages to a list of users
 */
async function handleBulkMessages(job: Job) {
  const p = job.data as SendBulkMessagesPayload;
  const account = await db.getTelegramAccountById(p.accountId);
  if (!account) throw new Error("Account not found");

  const bulkOp = await db.createBulkOperation({
    userId: account.userId,
    name: `Bulk Messages - ${new Date().toISOString()}`,
    operationType: "messages",
    status: "running",
    totalMembers: p.userIds.length,
    messageContent: p.messageTemplate,
    delayBetweenMessages: p.delayMs,
    description: JSON.stringify({ autoRepeat: p.autoRepeat }),
  } as any);

  const credentials = tg.getApiCredentials();
  const client = await tg.initializeClient(
    p.accountId,
    account.phoneNumber,
    account.sessionString,
    credentials.apiId,
    credentials.apiHash,
  );

  let success = 0;
  let failed = 0;

  for (let i = 0; i < p.userIds.length; i++) {
    const userId = p.userIds[i];
    try {
      await client.sendMessage(userId, { message: p.messageTemplate });
      success++;
    } catch (error: any) {
      // Handle Flood Wait
      if (error.seconds) {
        logger.warn(`[Worker] Flood wait for ${error.seconds}s, pausing...`);
        await new Promise(r => setTimeout(r, error.seconds * 1000 + 1000));
        try {
          await client.sendMessage(userId, { message: p.messageTemplate });
          success++;
        } catch {
          failed++;
        }
      } else {
        logger.error(`[Worker] Failed to send message to ${userId}: ${error.message}`);
        failed++;
      }
    }

    const progress = Math.floor(((i + 1) / p.userIds.length) * 100);
    await job.updateProgress(progress);

    // Dynamic delay with jitter
    const delay = p.delayMs || 1000;
    await new Promise(r => setTimeout(r, delay + Math.random() * 500));
  }

  await db.updateBulkOperation(bulkOp.id, {
    status: "completed",
    successfulMembers: success,
    failedMembers: failed,
    completedAt: new Date(),
  } as any);

  await db.updateTelegramAccount(p.accountId, {
    messagesSentToday: account.messagesSentToday + success,
    lastActivityAt: new Date(),
  });

  await db.createActivityLog({
    userId: account.userId,
    telegramAccountId: p.accountId,
    action: "bulk_messages_sent",
    details: JSON.stringify({ success, failed, total: p.userIds.length }),
    status: "success",
  });

  await tg.disconnectClient(p.accountId);
  return { success, failed, total: p.userIds.length };
}

/**
 * Join multiple groups/channels
 */
async function handleJoinGroups(job: Job) {
  const p = job.data as JoinGroupsPayload;
  const account = await db.getTelegramAccountById(p.accountId);
  if (!account) throw new Error("Account not found");

  const bulkOp = await db.createBulkOperation({
    userId: account.userId,
    name: `Join Groups - ${new Date().toISOString()}`,
    operationType: "join-groups",
    status: "running",
    totalMembers: p.groupLinks.length,
    delayBetweenMessages: p.delayMs,
    description: JSON.stringify({ groupLinks: p.groupLinks }),
  } as any);

  const credentials = tg.getApiCredentials();
  await tg.initializeClient(
    p.accountId,
    account.phoneNumber,
    account.sessionString,
    credentials.apiId,
    credentials.apiHash,
  );

  let success = 0;
  let failed = 0;

  for (let i = 0; i < p.groupLinks.length; i++) {
    const groupLink = p.groupLinks[i];
    try {
      const joined = await tg.joinGroup(p.accountId, groupLink);
      if (joined) success++;
      else failed++;
    } catch (error: any) {
      logger.error(`[Worker] Failed to join group ${groupLink}: ${error.message}`);
      failed++;
    }

    const progress = Math.floor(((i + 1) / p.groupLinks.length) * 100);
    await job.updateProgress(progress);

    // Delay between joins
    const delay = p.delayMs || 2000;
    await new Promise(r => setTimeout(r, delay + Math.random() * 1000));
  }

  await db.updateBulkOperation(bulkOp.id, {
    status: "completed",
    successfulMembers: success,
    failedMembers: failed,
    completedAt: new Date(),
  } as any);

  await db.createActivityLog({
    userId: account.userId,
    telegramAccountId: p.accountId,
    action: "groups_joined",
    details: JSON.stringify({ success, failed, total: p.groupLinks.length }),
    status: "success",
  });

  await tg.disconnectClient(p.accountId);
  return { success, failed, total: p.groupLinks.length };
}

worker.on("completed", (job) => logger.info(`[Worker] Job ${job.id} completed`));
worker.on("failed", (job, err) => logger.error(`[Worker] Job ${job?.id} failed: ${err.message}`));

export default worker;

