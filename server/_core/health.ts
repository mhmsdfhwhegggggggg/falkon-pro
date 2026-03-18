import { Request, Response } from "express";
import { getDb } from "../db";

/**
 * Health check endpoint
 * Returns the status of the application and its dependencies
 */
export async function healthCheck(req: Request, res: Response) {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    checks: {
      database: "unknown",
      memory: "ok",
      cpu: "ok",
    },
  };

  try {
    // Check database connection
    const db = await getDb();
    if (db) {
      health.checks.database = "ok";
    } else {
      health.checks.database = "error";
      health.status = "degraded";
    }
  } catch (error) {
    health.checks.database = "error";
    health.status = "degraded";
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  if (memUsagePercent > 90) {
    health.checks.memory = "warning";
    health.status = "degraded";
  }

  // Return appropriate status code
  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
}

/**
 * Readiness check endpoint
 * Returns whether the application is ready to serve traffic
 */
export async function readinessCheck(req: Request, res: Response) {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(503).json({
        ready: false,
        reason: "Database not connected",
      });
    }

    res.json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      reason: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Liveness check endpoint
 * Returns whether the application is alive
 */
export function livenessCheck(req: Request, res: Response) {
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
  });
}
