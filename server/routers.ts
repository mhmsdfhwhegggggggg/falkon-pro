import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, router } from "./_core/trpc";
import { accountsRouter } from "./routers/accounts.router";
import { extractionRouter } from "./routers/extraction.router";
import { bulkOpsRouter } from "./routers/bulk-ops.router";
import { statsRouter } from "./routers/stats.router";
import { proxiesRouter } from "./routers/proxies.router";
import { dashboardRouter } from "./routers/dashboard.router";
import { setupRouter } from "./routers/setup.router";
import { antiBanRouter } from "./routers/anti-ban";
import { licenseRouter } from "./routers/license";
import { permissionRouter } from "./routers/permission.router";
import { extractAddRouter } from "./routers/extract-add.router";
import { channelManagementRouter } from "./routers/channel-management.router";
import { autoReplyRouter } from "./routers/auto-reply.router";
import { contentClonerRouter } from "./routers/content-cloner.router";
import { systemRouter } from "./routers/system.router";
import { authRouter } from "./routers/auth.router";
import { backupRouter } from "./routers/backup.router";
import { aiAntiBanRouter } from "./routers/ai-anti-ban.router";
import { securityRouter } from "./routers/security.router";

// Export types for anti-ban integration
export type {
  ComprehensiveAccountStatus,
  OperationApproval,
  SystemStatistics
} from "./services/anti-ban-integration";

export const appRouter = router({
  // System & Auth
  system: systemRouter,
  auth: authRouter,

  // Core Features
  accounts: accountsRouter,
  extraction: extractionRouter,
  bulkOps: bulkOpsRouter,
  stats: statsRouter,
  proxies: proxiesRouter,
  dashboard: dashboardRouter,
  setup: setupRouter,

  // Advanced Features
  antiBan: antiBanRouter,
  license: licenseRouter,
  permission: permissionRouter,
  extractAdd: extractAddRouter,
  channelManagement: channelManagementRouter,
  autoReply: autoReplyRouter,
  contentCloner: contentClonerRouter,

  // New Security & Maintenance Features
  backup: backupRouter,
  aiAntiBan: aiAntiBanRouter,
  security: securityRouter,
});

export type AppRouter = typeof appRouter;
