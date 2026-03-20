import "dotenv/config";
import { describe, expect, it, beforeEach, afterAll, vi } from "vitest";
import { appRouter } from "../server/routers";
import { getDb, closeDb } from "../server/db";
import { users, licenses } from "../server/db/schema";
import { eq } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";
import { hashPassword } from "../server/_core/crypto";

/**
 * Integration Test for Licensing and RBAC
 * Verifies that:
 * 1. Admin functions are restricted to admins.
 * 2. Functional routes require an active license.
 * 3. License is bound to HWID correct.
 */
describe("Licensing Integration", () => {
    let testAdmin: any = null;
    let testUser: any = null;
    let licenseKey = "";

    // Helper to create context
    const createContext = (user: any = null, hwid: string = ""): TrpcContext => ({
        user,
        req: {
            headers: {
                "x-hwid": hwid
            }
        } as any,
        res: {
            cookie: vi.fn(),
            clearCookie: vi.fn()
        } as any,
    });

    beforeEach(async () => {
        const database = await getDb();
        if (!database) throw new Error("DB not connected");

        // Create a test admin and test user if they don't exist
        const adminEmail = `test-admin-${Date.now()}@falcon.pro`;
        const userEmail = `test-user-${Date.now()}@user.pro`;

        if (!testAdmin) {
            const [admin] = await database.insert(users).values({
                email: adminEmail,
                username: `testadmin_${Date.now()}`,
                password: await hashPassword("password123"),
                role: "admin",
                isActive: true
            }).returning();
            testAdmin = admin;
        }

        if (!testUser) {
            const [user] = await database.insert(users).values({
                email: userEmail,
                username: `testuser_${Date.now()}`,
                password: await hashPassword("password123"),
                role: "user",
                isActive: true
            }).returning();
            testUser = user;
        }
    });

    afterAll(async () => {
        const database = await getDb();
        if (database) {
            if (testAdmin) await database.delete(users).where(eq(users.id, testAdmin.id));
            if (testUser) {
                // Delete associated licenses first
                await database.delete(licenses).where(eq(licenses.userId, testUser.id));
                await database.delete(users).where(eq(users.id, testUser.id));
            }
        }
        await closeDb();
    });

    it("should prevent non-admins from generating licenses", async () => {
        const ctx = createContext(testUser);
        const caller = appRouter.createCaller(ctx);

        await expect(caller.license.generateLicense({
            userId: testUser.id,
            type: "basic",
            durationDays: 30,
            maxAccounts: 10,
            maxMessages: 1000
        })).rejects.toThrow(/You do not have required permission/i);
    });

    it("should allow admins to generate licenses", async () => {
        const ctx = createContext(testAdmin);
        const caller = appRouter.createCaller(ctx);

        const result = await caller.license.generateLicense({
            userId: testUser.id,
            type: "premium",
            durationDays: 30,
            maxAccounts: 50,
            maxMessages: 5000
        });

        expect(result.success).toBe(true);
        expect(result.licenseKey).toBeDefined();
        licenseKey = result.licenseKey!;
    });

    it("should prevent access to functional routes without active license", async () => {
        const ctx = createContext(testUser);
        const caller = appRouter.createCaller(ctx);

        await expect(caller.dashboard.getStats()).rejects.toThrow(/A valid and active license is required/i);
    });

    it("should activate a license and bind it to HWID", async () => {
        const ctx = createContext(); 
        const caller = appRouter.createCaller(ctx);

        const result = await caller.license.activateLicense({
            licenseKey: licenseKey,
            hardwareId: "TEST-HWID-001"
        });

        expect(result.success).toBe(true);
    });

    it("should allow access once license is active and HWID matches", async () => {
        const ctx = createContext(testUser, "TEST-HWID-001");
        const caller = appRouter.createCaller(ctx);

        const stats = await caller.dashboard.getStats();
        expect(stats).toBeDefined();
    });

    it("should reject access if HWID does not match", async () => {
        const ctx = createContext(testUser, "DIFFERENT-HWID");
        const caller = appRouter.createCaller(ctx);

        await expect(caller.dashboard.getStats()).rejects.toThrow(/License is bound to another device/i);
    });

    it("should verify adminProcedure strictly checks role", async () => {
        const adminCaller = appRouter.createCaller(createContext(testAdmin));
        const userCaller = appRouter.createCaller(createContext(testUser));

        const analytics = await adminCaller.license.getAnalytics();
        expect(analytics.success).toBe(true);

        await expect(userCaller.license.getAnalytics()).rejects.toThrow(/You do not have required permission/i);
    });
});
