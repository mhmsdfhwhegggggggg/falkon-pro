import { router, publicProcedure, licenseProtectedProcedure } from "../_core/trpc";
import { z } from "zod";
import os from "os";
import { ENV } from "../_core/env";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { redis } from "../_core/queue";

export const systemRouter = router({
  health: publicProcedure.query(async () => {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: Date.now(),
      version: ENV.appVersion,
    };
  }),

  metrics: licenseProtectedProcedure.query(async () => {
    const memoryUsage = process.memoryUsage();
    return {
      cpu: os.loadavg(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        process: memoryUsage.rss,
      },
      os: {
        platform: os.platform(),
        release: os.release(),
        uptime: os.uptime(),
      },
    };
  }),

  // Database Health Check
  dbHealth: licenseProtectedProcedure.query(async () => {
    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      return { status: "ok", latency: Date.now() - start };
    } catch (e: any) {
      return { status: "error", error: e.message };
    }
  }),

  // Redis Health Check
  redisHealth: licenseProtectedProcedure.query(async () => {
    try {
      if (!redis) return { status: "skipped", message: "Redis not configured" };
      const start = Date.now();
      await redis.ping();
      return { status: "ok", latency: Date.now() - start };
    } catch (e: any) {
      return { status: "error", error: e.message };
    }
  }),
});
