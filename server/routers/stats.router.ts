import { z } from "zod";
import { router, licenseProtectedProcedure, adminProcedure } from "../_core/trpc";
import * as db from "../db";

/**
 * Statistics Router
 * Handles analytics and reporting
 */
export const statsRouter = router({
  /**
   * Get account statistics for a specific date
   */
  getDailyStats: licenseProtectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        date: z.string(), // YYYY-MM-DD format
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const account = await db.getTelegramAccountById(input.accountId);

        if (!account || account.userId !== ctx.user!.id) {
          throw new Error("Account not found or unauthorized");
        }

        const stats = await db.getOrCreateStatistics(input.accountId, input.date);

        return {
          success: true,
          stats: {
            date: stats.date,
            messagesSent: stats.messagesSent,
            messagesFailed: stats.messagesFailed,
            membersExtracted: stats.membersExtracted,
            groupsJoined: stats.groupsJoined,
            groupsLeft: stats.groupsLeft,
            usersAdded: stats.usersAdded,
            successRate: stats.successRate,
          },
        };
      } catch (error) {
        console.error("Failed to get daily stats:", error);
        throw new Error("Failed to get daily stats");
      }
    }),

  /**
   * Get today's statistics
   */
  getTodayStats: licenseProtectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input, ctx }) => {
      try {
        const account = await db.getTelegramAccountById(input.accountId);

        if (!account || account.userId !== ctx.user!.id) {
          throw new Error("Account not found or unauthorized");
        }

        const today = new Date().toISOString().split("T")[0];
        const stats = await db.getOrCreateStatistics(input.accountId, today);

        return {
          success: true,
          stats: {
            date: stats.date,
            messagesSent: stats.messagesSent,
            messagesFailed: stats.messagesFailed,
            membersExtracted: stats.membersExtracted,
            groupsJoined: stats.groupsJoined,
            groupsLeft: stats.groupsLeft,
            usersAdded: stats.usersAdded,
            successRate: stats.successRate,
            accountStatus: {
              messagesSentToday: account.messagesSentToday,
              dailyLimit: account.dailyLimit,
              warmingLevel: account.warmingLevel,
              isRestricted: account.isRestricted,
            },
          },
        };
      } catch (error) {
        console.error("Failed to get today stats:", error);
        throw new Error("Failed to get today stats");
      }
    }),

  /**
   * Get activity logs
   */
  getActivityLogs: licenseProtectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const account = await db.getTelegramAccountById(input.accountId);

        if (!account || account.userId !== ctx.user!.id) {
          throw new Error("Account not found or unauthorized");
        }

        const logs = await db.getActivityLogsByAccountId(input.accountId, input.limit);

        return {
          success: true,
          logs: logs.map((log: any) => ({
            id: log.id,
            action: log.action,
            status: log.status,
            details: log.details,
            error: null as string | null,
            createdAt: log.timestamp,
          })),
        };
      } catch (error) {
        console.error("Failed to get activity logs:", error);
        throw new Error("Failed to get activity logs");
      }
    }),

  /**
   * Get account overview
   */
  getAccountOverview: licenseProtectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input, ctx }) => {
      try {
        const account = await db.getTelegramAccountById(input.accountId);

        if (!account || account.userId !== ctx.user!.id) {
          throw new Error("Account not found or unauthorized");
        }

        const today = new Date().toISOString().split("T")[0];
        const stats = await db.getOrCreateStatistics(input.accountId, today);

        return {
          success: true,
          overview: {
            phoneNumber: account.phoneNumber,
            firstName: account.firstName,
            lastName: account.lastName,
            username: account.username,
            isActive: account.isActive,
            isRestricted: account.isRestricted,
            warmingLevel: account.warmingLevel,
            messagesSentToday: account.messagesSentToday,
            dailyLimit: account.dailyLimit,
            lastActivityAt: account.lastActivityAt,
            lastRestrictedAt: account.lastRestrictedAt,
            todayStats: {
              messagesSent: stats.messagesSent,
              messagesFailed: stats.messagesFailed,
              membersExtracted: stats.membersExtracted,
              groupsJoined: stats.groupsJoined,
              groupsLeft: stats.groupsLeft,
              usersAdded: stats.usersAdded,
              successRate: stats.successRate,
            },
          },
        };
      } catch (error) {
        console.error("Failed to get account overview:", error);
        throw new Error("Failed to get account overview");
      }
    }),

  /**
   * Get performance metrics
   */
  getPerformanceMetrics: licenseProtectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input, ctx }) => {
      try {
        const account = await db.getTelegramAccountById(input.accountId);

        if (!account || account.userId !== ctx.user!.id) {
          throw new Error("Account not found or unauthorized");
        }

        const today = new Date().toISOString().split("T")[0];
        const stats = await db.getOrCreateStatistics(input.accountId, today);

        const totalOperations = stats.messagesSent + stats.messagesFailed;
        const successRate =
          totalOperations > 0 ? (stats.messagesSent / totalOperations) * 100 : 0;

        return {
          success: true,
          metrics: {
            successRate: Math.round(successRate),
            totalOperations,
            successfulOperations: stats.messagesSent,
            failedOperations: stats.messagesFailed,
            warmingLevel: account.warmingLevel,
            accountHealth: account.isRestricted ? "restricted" : "healthy",
            utilizationRate: Math.round(
              (account.messagesSentToday / account.dailyLimit) * 100
            ),
          },
        };
      } catch (error) {
        console.error("Failed to get performance metrics:", error);
        throw new Error("Failed to get performance metrics");
      }
    }),
  /**
   * Get global statistics for the user (Admin Only)
   */
  getGlobalStats: adminProcedure.query(async ({ ctx }) => {
    const totalOperations = await db.getOperationsCountToday() || 0;
    const activeAccounts = await db.getActiveAccountsCount() || 0;

    return {
      successRate: 98.5, // Placeholder or calculated if needed
      totalOperations,
      activeAccounts,
      blockedAttacks: 157, // Placeholder
    };
  }),
});

