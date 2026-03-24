import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb, users, getUserByEmail } from "../db";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { ENV } from "../_core/env";
import { hashPassword, verifyPassword } from "../_core/crypto";
import { StartupService } from "../services/startup.service";
import { logger } from "../_core/logger";

export const authRouter = router({
    login: publicProcedure
        .input(z.object({ email: z.string().email(), password: z.string() }))
        .mutation(async ({ input }) => {
            try {
                const user = await getUserByEmail(input.email);
                
                if (!user || !verifyPassword(input.password, user.password)) {
                    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
                }

                const token = await new SignJWT({
                    userId: user.id,
                    email: user.email,
                    role: user.role,
                    openId: user.email,
                    appId: ENV.appId,
                    name: user.username || "Admin"
                })
                    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
                    .setExpirationTime("7d")
                    .sign(new TextEncoder().encode(ENV.jwtSecret));

                return { token, user: { id: user.id, email: user.email, name: user.username, role: user.role } };
            } catch (err: any) {
                logger.error('[Auth] Login error:', err);
                if (err instanceof TRPCError) throw err;
                throw new TRPCError({ 
                    code: 'INTERNAL_SERVER_ERROR', 
                    message: `Internal error during login: ${err.message}` 
                });
            }
        }),

    register: publicProcedure
        .input(z.object({ email: z.string().email(), password: z.string().min(6), name: z.string() }))
        .mutation(async ({ input }) => {
            if (!ENV.enableRegistration) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Registration is disabled" });
            }

            const existing = await getUserByEmail(input.email);

            if (existing) {
                throw new TRPCError({ code: "CONFLICT", message: "User already exists" });
            }

            const database = await getDb();
            if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not connected' });
            const [newUser] = await database.insert(users).values({
                email: input.email,
                password: hashPassword(input.password),
                username: input.name,
                role: "user",
            } as any).returning();

            // Auto-create trial license for new users
            await StartupService.ensureTrialLicense(newUser.id);

            const token = await new SignJWT({
                userId: newUser.id,
                email: newUser.email,
                role: newUser.role,
                openId: newUser.email,
                appId: ENV.appId,
                name: newUser.username || "User"
            })
                .setProtectedHeader({ alg: "HS256", typ: "JWT" })
                .setExpirationTime("7d")
                .sign(new TextEncoder().encode(ENV.jwtSecret));

            return { token, user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role } };
        }),

    logout: publicProcedure
        .mutation(async () => {
            return { success: true };
        }),
});

