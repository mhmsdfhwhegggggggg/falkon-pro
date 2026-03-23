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
import { ENV } from "./_core/env";
import { TelegramClientService } from "./services/telegram-client.service";
import { industrialExtractor } from "./services/industrial-extractor";
import { highSpeedAdder } from "./services/high-speed-adder";
import { encryptString } from "./_core/crypto";
import { getCache } from "./_core/cache-system";
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

async function handleSendLoginCodes(job: Job) {
  const { phoneNumbers } = job.data as any;
  const cache = getCache();
  let success = 0;
  let failed = 0;

  for (let i = 0; i < phoneNumbers.length; i++) {
    const phone = phoneNumbers[i];
    try {
      const phoneCodeHash = await tg.sendCode(phone);
      // Store hash in cache for 15 minutes
      await cache.set(`login_hash:${phone}`, phoneCodeHash, { ttl: 900 });
      success++;
    } catch (error: any) {
      console.error(`[Worker] Failed to send code to ${phone}: ${error.message}`);
      failed++;
    }
    await job.updateProgress(Math.floor(((i + 1) / phoneNumbers.length) * 100));
  }
  return { success, failed };
}

async function handleConfirmLoginCodes(job: Job) {
  const { userId, items } = job.data as any;
  const cache = getCache();
  let success = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const phoneCodeHash = await cache.get(`login_hash:${item.phoneNumber}`);
      if (!phoneCodeHash) throw new Error(`No hash found for ${item.phoneNumber}`);

      const sessionString = await tg.signIn(item.phoneNumber, phoneCodeHash, item.code, item.password);
      
      // Encrypt and save to DB
      const encryptedSession = encryptString(sessionString);
      
      await db.createTelegramAccount({
        userId,
        phoneNumber: item.phoneNumber,
        sessionString: encryptedSession,
        isActive: true,
        warmingLevel: 0,
        messagesSentToday: 0,
        dailyLimit: 100,
        createdAt: new Date(),
      } as any);

      await cache.delete(`login_hash:${item.phoneNumber}`);
      success++;
    } catch (error: any) {
      console.error(`[Worker] Failed to confirm code for ${item.phoneNumber}: ${error.message}`);
      failed++;
    }
    await job.updateProgress(Math.floor(((i + 1) / items.length) * 100));
  }
  return { success, failed };
}

worker.on("completed", (job) => console.log(`[Worker] Job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`[Worker] Job ${job?.id} failed: ${err.message}`));

export default worker;
