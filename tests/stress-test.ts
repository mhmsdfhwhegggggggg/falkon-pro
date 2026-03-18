import "dotenv/config";
import axios from 'axios';
import { getDb, closeDb } from '../server/db';
import { users, licenses } from '../server/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../server/_core/crypto';

/**
 * Robust Authenticated Stress Test for Dragon Pro
 * Verifies system stability under high concurrent load with real auth and licensing.
 */

const API_BASE = 'http://localhost:3000/api/trpc';
const CONCURRENCY = 10;
const TOTAL_REQUESTS = 200;
const TEST_EMAIL = `stress-test-${Date.now()}@test.com`;
const TEST_PASS = 'Password123!';
const TEST_HWID = 'STRESS-DEVICE-999';

async function runStressTest() {
    console.log(`\n🚀 Initializing Authenticated Stress Test...`);
    
    const db = await getDb();
    if (!db) throw new Error("Could not connect to database");

    // 1. Setup Test User & License
    console.log(`Creating test user: ${TEST_EMAIL}`);
    const [user] = await db.insert(users).values({
        email: TEST_EMAIL,
        username: `stresstester_${Date.now()}`,
        password: await hashPassword(TEST_PASS),
        role: "user",
        isActive: true
    }).returning();

    console.log(`Generating license for user...`);
    const [license] = await db.insert(licenses).values({
        userId: user.id,
        licenseKey: `STRESS-KEY-${Date.now()}`,
        type: "pro",
        status: "active",
        hardwareId: TEST_HWID,
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
    }).returning();

    // 2. Login to get JWT Token
    console.log(`Logging in to get authentication token...`);
    const loginRes = await axios.post(`${API_BASE}/auth.login`, {
        json: { email: TEST_EMAIL, password: TEST_PASS }
    });
    
    const token = loginRes.data?.result?.data?.json?.token;
    if (!token) throw new Error("Failed to retrieve authentication token");
    console.log(`✅ Authentication successful. Starting load test...`);

    const start = Date.now();
    let successCount = 0;
    let errorCount = 0;

    const endpoints = [
        'system.health',
        'dashboard.getStats',
        'stats.getGlobalStats',
        'accounts.getAll'
    ];

    const activeRequests = new Set();
    const results: Promise<void>[] = [];

    for (let i = 0; i < TOTAL_REQUESTS; i++) {
        if (activeRequests.size >= CONCURRENCY) {
            await Promise.race(activeRequests);
        }

        const endpoint = endpoints[i % endpoints.length];
        const promise = (async () => {
            try {
                const url = `${API_BASE}/${endpoint}?batch=1&input=%7B%22json%22%3Anull%7D`;
                const response = await axios.get(url, {
                    timeout: 10000,
                    headers: {
                        'x-hwid': TEST_HWID,
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.status === 200) successCount++;
                else errorCount++;
            } catch (error: any) {
                errorCount++;
                if (errorCount <= 3) {
                    console.error(`[Load Error on ${endpoint}]:`, error.response?.data?.[0]?.error?.message || error.message);
                }
            }
        })();

        activeRequests.add(promise);
        results.push(promise);
        promise.finally(() => activeRequests.delete(promise));
    }

    await Promise.all(results);

    const duration = Date.now() - start;
    const rps = (TOTAL_REQUESTS / (duration / 1000)).toFixed(2);

    console.log(`\n📊 Stress Test Results:`);
    console.log(`-----------------------------`);
    console.log(`Total Requests: ${TOTAL_REQUESTS}`);
    console.log(`Success:        ${successCount} ✅`);
    console.log(`Errors:         ${errorCount} ❌`);
    console.log(`Total Duration: ${duration}ms`);
    console.log(`Avg RPS:        ${rps} req/s`);
    console.log(`-----------------------------\n`);

    // 3. Cleanup
    console.log(`Cleaning up test data...`);
    await db.delete(licenses).where(eq(licenses.id, license.id));
    await db.delete(users).where(eq(users.id, user.id));
    await closeDb();

    if (errorCount > (TOTAL_REQUESTS * 0.05)) {
        console.error('❌ CRITICAL: Error rate too high (>5%)! System might be unstable under load.');
        process.exit(1);
    } else {
        console.log('✅ PASS: System remained stable under extreme pressure.');
    }
}

runStressTest().catch(console.error);
