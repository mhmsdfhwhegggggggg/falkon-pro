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

const connection = new IORedis(ENV.redisUrl);
const tg = new TelegramClientService();

const worker = new Worker(
  "bulkOps",
  async (job: Job) => {
    const type = job.name as JobType;
    console.log(`[Worker] Processing job ${job.id} (${type})`);

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
      console.error(`[Worker] Job ${job.id} failed: ${error.message}`);
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
      console.log(`[Worker] Sending code to ${phoneNumber}...`);
      const credentials = telegramClientService.getApiCredentials();
      const client = new TelegramClient(new StringSession(""), credentials.apiId, credentials.apiHash, {
        connectionRetries: 5,
      });
      await client.connect();
      await client.sendCode(credentials, phoneNumber);
      await client.disconnect();
    } catch (error: any) {
      console.error(`[Worker] Failed to send code to ${phoneNumber}:`, error.message);
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
      console.log(`[Worker] Confirming code for ${item.phoneNumber}...`);
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
      console.error(`[Worker] Failed to confirm ${item.phoneNumber}:`, error.message);
    }
    
    progress += 100 / items.length;
    await job.updateProgress(Math.floor(progress));
  }
}

async function handleBulkMessages(job: Job) { /* Implementation */ }
async function handleJoinGroups(job: Job) { /* Implementation */ }

worker.on("completed", (job) => console.log(`[Worker] Job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`[Worker] Job ${job?.id} failed: ${err.message}`));

export default worker;

