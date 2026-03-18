import { router, licenseProtectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { db, antiBanRules } from "../db";
import { eq } from "drizzle-orm";
import { AntiBanEngineV5 } from "../services/anti-ban-engine-v5";

export const aiAntiBanRouter = router({
    getRules: licenseProtectedProcedure
        .input(z.object({ accountId: z.number() }))
        .query(async ({ input }) => {
            return db.query.antiBanRules.findMany({
                where: eq(antiBanRules.telegramAccountId, input.accountId),
            });
        }),

    updateRule: licenseProtectedProcedure
        .input(z.object({
            id: z.number(),
            data: z.object({
                dailyLimit: z.number().optional(),
                cooldownMinutes: z.number().optional(),
                maxConsecutiveErrors: z.number().optional(),
            }),
        }))
        .mutation(async ({ input }) => {
            return db.update(antiBanRules)
                .set(input.data)
                .where(eq(antiBanRules.id, input.id))
                .returning();
        }),

    getPrediction: licenseProtectedProcedure
        .input(z.object({
            accountId: z.number(),
            operationType: z.enum(['message', 'add_member', 'join_group', 'extract_members', 'leave_group']).optional().default('message'),
        }))
        .query(async ({ input }) => {
            const engine = AntiBanEngineV5.getInstance();
            // Create a minimal context for prediction
            const context: any = {
                accountId: input.accountId,
                operationType: input.operationType,
                speed: 'medium',
                timeOfDay: new Date().getHours(),
                dayOfWeek: new Date().getDay(),
                accountAge: 180, // Simulation default
                recentActivityCount: 0,
            };

            const recommendation = await engine.analyzeOperation(context);

            return {
                banProbability: recommendation.riskScore,
                riskLevel: recommendation.riskScore < 30 ? "low" : recommendation.riskScore < 70 ? "medium" : "high",
                recommendedAction: recommendation.action,
                confidence: recommendation.confidence
            };
        }),
});
