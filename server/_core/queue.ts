import { Queue, QueueEvents, JobsOptions, Job } from "bullmq";
import IORedis from "ioredis";
import { ENV } from "./env";
import { Secrets } from "./secrets";

export type JobType =
  | "send-bulk-messages"
  | "join-groups"
  | "add-users"
  | "extract-and-add"
  | "send-login-codes"
  | "confirm-login-codes";

export type SendBulkMessagesPayload = {
  accountId: number;
  userIds: string[];
  messageTemplate: string;
  delayMs: number;
  autoRepeat: boolean;
};

export type JoinGroupsPayload = {
  accountId: number;
  groupLinks: string[];
  delayMs: number;
};

export type AddUsersPayload = {
  accountId: number;
  groupId: string;
  userIds: string[];
  delayMs: number;
};

export type ExtractAndAddPayload = {
  accountId: number;
  source: string; // link/@/id
  target: string; // link/@/id
  extractMode: "all" | "engaged" | "admins";
  daysActive?: number;
  excludeBots: boolean;
  requireUsername: boolean;
  limit?: number;
  dedupeBy: "telegramUserId" | "username";
  delayMs: number;
};

export type JobPayload =
  | SendBulkMessagesPayload
  | JoinGroupsPayload
  | AddUsersPayload
  | ExtractAndAddPayload
  | SendLoginCodesPayload
  | ConfirmLoginCodesPayload;
export type SendLoginCodesPayload = {
  phoneNumbers: string[];
};

export type ConfirmLoginCodesPayload = {
  userId: number;
  items: { phoneNumber: string; code: string; password?: string }[];
};

export type OnboardingPayload = SendLoginCodesPayload | ConfirmLoginCodesPayload;

// Create a mock queue system that doesn't require Redis
class MockQueue {
  private jobs = new Map<string, any>();
  private jobIdCounter = 1;

  async add(type: string, payload: any, options?: any) {
    const id = String(this.jobIdCounter++);
    const job = {
      id,
      name: type,
      data: payload,
      opts: options,
      timestamp: Date.now(),
      progress: 0,
      returnvalue: null,
      failedReason: null,
      processedOn: null,
      finishedOn: null,
      getState: () => 'completed',
      moveToFailed: async () => { },
      updateProgress: async (progress: number) => {
        this.jobs.set(id, { ...this.jobs.get(id), progress });
      }
    };
    this.jobs.set(id, job);
    return job;
  }

  async getJob(id: string) {
    return this.jobs.get(id);
  }

  async getJobs(states: string[], start: number, end: number) {
    return Array.from(this.jobs.values()).slice(start, end);
  }
}

// Try to connect to Redis, fallback to mock if it fails
let connection: IORedis | null = null;
let bulkOpsQueue: Queue | MockQueue;
let bulkOpsEvents: QueueEvents | null = null;

async function initializeQueue() {
  const redisUrl = Secrets.getRedisUrl() || ENV.redisUrl;

  if (!redisUrl) {
    console.info('[Queue] No Redis URL provided, using mock queue by default.');
    connection = null;
    bulkOpsQueue = new MockQueue();
    return;
  }

  try {
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    // Test connection
    connection.on('error', (err) => {
      // Only warn if we haven't already fallen back
      if (connection) {
        console.warn('[Queue] Redis connection error, falling back to mock queue:', err.message);
        connection = null;
        bulkOpsQueue = new MockQueue();
      }
    });

    // Try to connect
    await connection.connect();
    redis = connection;
    bulkOpsQueue = new Queue("bulkOps", { connection });
    bulkOpsEvents = new QueueEvents("bulkOps", { connection });
    if (bulkOpsEvents.waitUntilReady) {
      await bulkOpsEvents.waitUntilReady();
    }
    console.log('[Queue] Connected to Redis successfully');
  } catch (error: any) {
    console.warn('[Queue] Redis not available, using mock queue:', error.message);
    connection = null;
    bulkOpsQueue = new MockQueue();
  }
}

// Initialize queue asynchronously
initializeQueue().catch(console.error);

class BullJobQueue {
  async enqueue(type: JobType, payload: JobPayload) {
    const opts: JobsOptions = {
      attempts: 3,
      removeOnComplete: 1000,
      removeOnFail: 5000,
      backoff: { type: "exponential", delay: 2000 },
    };
    const job = await bulkOpsQueue.add(type, payload, opts);
    return { id: job.id as string };
  }

  async getJob(id: string) {
    const job = await bulkOpsQueue.getJob(id);
    if (!job) return undefined;
    const state = await job.getState();
    const progress = (typeof job.progress === "number" ? job.progress : 0) as number;
    const result = (job as any).returnvalue ?? null;
    const failedReason = job.failedReason || undefined;
    return {
      id: String(job.id),
      status: state as any,
      progress,
      result: result ?? null,
      error: failedReason ?? null,
      createdAt: job.timestamp ? new Date(job.timestamp) : undefined,
      startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  }
}

export const JobQueue = new BullJobQueue();
export let redis: IORedis | null = null;

export async function cancelJob(jobId: string) {
  const job = await bulkOpsQueue.getJob(jobId);
  if (!job) return { found: false } as const;
  // Move to failed with cancelled reason and allow retries to be ignored
  await (job as any).moveToFailed(new Error("cancelled"), "cancelled", true);
  return { found: true, cancelled: true } as const;
}

export async function listJobs(state: ("waiting" | "active" | "delayed" | "completed" | "failed")[] = ["waiting", "active", "delayed"], start = 0, end = 50) {
  const jobs = await bulkOpsQueue.getJobs(state, start, end);
  return jobs.map((j: any) => ({ id: String(j.id), name: j.name, state: j.getState(), progress: typeof j.progress === 'number' ? j.progress : 0, timestamp: j.timestamp }));
}
