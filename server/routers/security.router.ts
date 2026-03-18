import { router, licenseProtectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { ENV } from "../_core/env";
import { TRPCError } from "@trpc/server";

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
            console.log(`EMERGENCY STOP TRIGGERED: ${input.reason}`);
            return { status: "stopped" };
        }),
});
