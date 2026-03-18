import "dotenv/config"; // Restarted for service and router sync
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { redis } from "./queue";

// Type assertion for redis
const redisClient = redis as any;
import { db, getDb } from "../db";
import { healthCheck, readinessCheck, livenessCheck } from "./health";
import { CacheSystem } from "./cache-system";
import { StartupService } from "../services/startup.service";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Initialize CacheSystem with Redis (if available)
  try {
    if (redisClient) {
      CacheSystem.getInstance(redisClient);
    }
  } catch (error) {
    console.warn('[CacheSystem] Failed to initialize with Redis:', error);
  }

  const app = express();
  const server = createServer(app);

  // Enable CORS with allowlist; reflect origin only in development if no list provided
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const list = ENV.corsOrigins;
    if (origin) {
      const allowed = list.length > 0 ? list.includes(origin) : !ENV.isProduction;
      if (allowed) {
        res.header("Access-Control-Allow-Origin", origin);
      }
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  // Root status page prince
  app.get("/", (req, res) => {
    res.status(200).send(`
      <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
        <h1 style="color: #2563eb;">🚀 FALCON Server is Active</h1>
        <p>Heart-Beat Security Core V6.0.0 is running.</p>
        <p style="color: #64748b;">Visit <a href="/health">/health</a> for system status.</p>
        <div style="margin-top: 20px; font-size: 0.8em; color: #94a3b8;">Prince Edition</div>
      </div>
    `);
  });

  // Health check endpoints
  app.get("/health", healthCheck);
  app.get("/api/health", healthCheck);
  app.get("/ready", readinessCheck);
  app.get("/live", livenessCheck);

  // Legacy health check
  app.get("/api/health/legacy", async (_req, res) => {
    const now = Date.now();
    let redisOk = false;
    let dbOk = false;
    try {
      if (redisClient && typeof redisClient.ping === 'function') {
        const pong = await redisClient.ping();
        redisOk = pong === "PONG";
      }
    } catch { }
    try {
      const conn = await getDb();
      dbOk = !!conn;
    } catch { }
    res.json({ ok: redisOk && dbOk, redis: redisOk, db: dbOk, timestamp: now });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);

    // Initialize services
    StartupService.initializeAllServices().catch(err => console.error('[Startup] Failed:', err));
  });
}

startServer().catch(console.error);
