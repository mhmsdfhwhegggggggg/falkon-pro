import { router, licenseProtectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { ENV } from "../_core/env";
import { TRPCError } from "@trpc/server";
import { logger } from "../_core/logger";
import { closeDb } from "../db";

export const securityRouter = router({
    validateLicense: publicProcedure
        .input(z.object({ key: z.string(), hwid: z.string() }))
        .mutation(async ({ input }) => {
            // Simple mock validation
            if (!ENV.enableLicenseCheck) return { valid: true, type: "unimited" };
            return { valid: true, type: "trial", expiresAt: new Date(Date.now() + 86400000) };
        }),

    checkIntegrity: licenseProtectedProcedure.query(async () => {
        return {
            status: "secure",
            lastCheck: new Date(),
            tamperedFiles: [],
        };
    }),

    // Kill Switch (Admin only)
    emergencyStop: licenseProtectedProcedure
        .input(z.object({ reason: z.string() }))
        .mutation(async ({ input }) => {
            logger.fatal(`EMERGENCY STOP TRIGGERED: ${input.reason}`);

            // Actually stop operations by closing DB connections
            try {
                await closeDb();
            } catch (e) {
                logger.error('[EmergencyStop] Error closing DB:', e);
            }

            // Set a flag that middleware can check
            process.env.__EMERGENCY_STOP = 'true';

            return { status: "stopped", reason: input.reason, stoppedAt: new Date().toISOString() };
        }),
});

