
import 'dotenv/config';
import axios from 'axios';
import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import * as db from '../server/db';
import { eq, sql } from 'drizzle-orm';

const API_BASE = 'http://127.0.0.1:3000/api/trpc';
const TEST_ID = Date.now();
const TEST_EMAIL = `verify-${TEST_ID}@falcon.pro`;
const TEST_USER = {
    email: TEST_EMAIL,
    password: 'SecurePassword123!',
    username: 'ProdTester'
};
const TEST_HWID = 'PROD-READY-TEST-HWID';

let userToken: string;
let adminToken: string;
let testLicenseKey: string;
let createdUserId: number;
let testAccountId: number;

describe('Production Readiness: Global Functional Test', () => {

    test('Should register a new user', async () => {
        const res = await axios.post(`${API_BASE}/auth.register?batch=1`, {
            "0": { json: { email: TEST_USER.email, password: TEST_USER.password, name: TEST_USER.username } }
        });
        createdUserId = res.data[0].result.data.json.user.id;
        expect(createdUserId).toBeDefined();
    }, 30000);

    test('Should login and receive JWT', async () => {
        const res = await axios.post(`${API_BASE}/auth.login?batch=1`, {
            "0": { json: { email: TEST_USER.email, password: TEST_USER.password } }
        });
        userToken = res.data[0].result.data.json.token;
        expect(userToken).toBeDefined();
    }, 30000);

    test('Should restrict admin actions for regular user', async () => {
        try {
            await axios.post(`${API_BASE}/license.generateLicense?batch=1`, {
                "0": { json: { userId: createdUserId, type: 'trial', durationDays: 30, maxAccounts: 5, maxMessages: 1000 } }
            }, {
                headers: { 'Authorization': `Bearer ${userToken}` }
            });
            throw new Error('Should have failed');
        } catch (err: any) {
            expect(err.response.status).toBe(403);
        }
    }, 30000);

    test('Should activate license with HWID binding', async () => {
        const adminEmail = (process.env.ADMIN_EMAIL || 'admin@falcon.pro').replace(/"/g, '').trim();
        const adminPassword = (process.env.ADMIN_PASSWORD || 'Falcon@2024').replace(/"/g, '').trim();
        
        const loginRes = await axios.post(`${API_BASE}/auth.login?batch=1`, {
            "0": { json: { email: adminEmail, password: adminPassword } }
        });
        adminToken = loginRes.data[0].result.data.json.token;

        const genRes = await axios.post(`${API_BASE}/license.generateLicense?batch=1`, {
            "0": { json: { userId: createdUserId, type: 'premium', durationDays: 30, maxAccounts: 10, maxMessages: 5000 } }
        }, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        testLicenseKey = genRes.data[0].result.data.json.licenseKey;
        expect(testLicenseKey).toBeDefined();

        const actRes = await axios.post(`${API_BASE}/license.activateLicense?batch=1`, {
            "0": { json: { licenseKey: testLicenseKey, hardwareId: TEST_HWID } }
        }, {
            headers: { 'Authorization': `Bearer ${userToken}`, 'x-hwid': TEST_HWID }
        });
        expect(actRes.data[0].result.data.json.success).toBe(true);
    }, 30000);

    test('Should enforce HWID protection', async () => {
        try {
            await axios.post(`${API_BASE}/accounts.add?batch=1`, {
                "0": { json: { phoneNumber: `+${TEST_ID}`, sessionString: 'test', username: 'test' } }
            }, {
                headers: { 'Authorization': `Bearer ${userToken}`, 'x-hwid': 'FAKE-ID' }
            });
            throw new Error('Should have failed');
        } catch (err: any) {
            expect(err.response.data[0].error.json.message).toContain('License is bound to another device.');
        }
    }, 30000);

    test('Should manage Telegram Accounts', async () => {
        const addRes = await axios.post(`${API_BASE}/accounts.add?batch=1`, {
            "0": { json: { phoneNumber: `+${TEST_ID}`, sessionString: 'mock', username: 'tester' } }
        }, {
            headers: { 'Authorization': `Bearer ${userToken}`, 'x-hwid': TEST_HWID, 'x-license-key': testLicenseKey }
        });
        expect(addRes.status).toBe(200);
        
        const listRes = await axios.get(`${API_BASE}/accounts.getAll?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D`, {
            headers: { 'Authorization': `Bearer ${userToken}`, 'x-hwid': TEST_HWID, 'x-license-key': testLicenseKey }
        });
        testAccountId = listRes.data[0].result.data.json[0].id;
        expect(testAccountId).toBeDefined();
    }, 30000);

    test('Should handle Bulk Operations (Validation Check)', async () => {
        try {
            await axios.post(`${API_BASE}/bulkOps.sendBulkMessages?batch=1`, {
                "0": { json: { accountId: testAccountId, userIds: ['123'], messageTemplate: 'test' } }
            }, {
                headers: { 'Authorization': `Bearer ${userToken}`, 'x-hwid': TEST_HWID, 'x-license-key': testLicenseKey }
            });
        } catch (err: any) {
            if (err.response?.status === 500) {
                expect(JSON.stringify(err.response.data)).toContain('Not a valid string');
            }
        }
    }, 30000);

    test('Should retrieve Dashboard statistics', async () => {
        const res = await axios.get(`${API_BASE}/dashboard.getStats?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D`, {
            headers: { 'Authorization': `Bearer ${userToken}`, 'x-hwid': TEST_HWID, 'x-license-key': testLicenseKey }
        });
        expect(res.data[0].result.data.json.totalAccounts).toBeDefined();
    }, 30000);

    test('Should retrieve Global stats (Admin)', async () => {
        const statsRes = await axios.get(`${API_BASE}/stats.getGlobalStats?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D`, {
            headers: { 'Authorization': `Bearer ${adminToken}`, 'x-hwid': TEST_HWID }
        });
        expect(statsRes.status).toBe(200);
        expect(statsRes.data[0].result.data.json.activeAccounts).toBeDefined();
    }, 30000);

    afterAll(async () => {
        if (!createdUserId) return;
        const database = await db.getDb();
        if (database) {
            try {
                await (database as any).execute(sql`DELETE FROM telegram_accounts WHERE user_id = ${createdUserId}`);
                await (database as any).execute(sql`DELETE FROM licenses WHERE "userId" = ${createdUserId}`);
                await database.delete(db.users).where(eq(db.users.id, createdUserId));
            } catch (err) {}
        }
    });
});
