import { router, licenseProtectedProcedure } from "../_core/trpc";
import * as dbHelper from "../db";

export const dashboardRouter = router({
  // Get dashboard statistics
  getStats: licenseProtectedProcedure.query(async ({ ctx }) => {
    try {
      const database = await dbHelper.getDb();
      if (!database) throw new Error("DB not connected");

      // 1. Get account counts in one go
      const accounts = await dbHelper.getTelegramAccountsByUserId(ctx.user!.id);
      const totalAccounts = accounts.length;
      const activeAccounts = accounts.filter((a) => a.isActive).length;

      // 2. Optimized member count using aggregate (avoiding row fetch)
      const memberCountResult = await (database as any).execute(dbHelper.sql`
        SELECT COUNT(*) as count 
        FROM extracted_members 
        WHERE user_id = ${ctx.user!.id}
      `);
      const membersExtracted = Number(memberCountResult[0]?.count) || 0;

      // 3. Messages sent today (using the already fetched accounts)
      const messagesToday = accounts.reduce((sum, acc) => sum + acc.messagesSentToday, 0);

      return {
        totalAccounts,
        activeAccounts,
        membersExtracted,
        messagesToday,
      };
    } catch (error) {
      console.error("Failed to get dashboard stats:", error);
      return { totalAccounts: 0, activeAccounts: 0, membersExtracted: 0, messagesToday: 0 };
    }
  }),

  // Get recent activities
  getRecentActivities: licenseProtectedProcedure.query(async ({ ctx }) => {
    try {
      const database = await dbHelper.getDb();
      if (!database) throw new Error("DB not connected");

      // Optimized: Get recent logs for all user accounts in one query
      const logs = await (database as any).execute(dbHelper.sql`
        SELECT al.action, al.status, al.details, al.timestamp as "createdAt"
        FROM activity_logs al
        WHERE al."userId" = ${ctx.user!.id}
        ORDER BY al.timestamp DESC
        LIMIT 10
      `);

      return logs.map((activity: any) => ({
        time: new Date(activity.createdAt).toISOString(),
        action: activity.action,
        status: activity.status,
        details: activity.details,
      }));
    } catch (error) {
      console.error("Failed to get recent activities:", error);
      return [];
    }
  }),
});

