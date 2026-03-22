import * as db from './server/db';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

async function setupLicense() {
    try {
        const database = await db.getDb();
        if (!database) {
            console.error("Database connection failed.");
            process.exit(1);
        }
        
        // 1. Create a test user
        const email = "test-live-" + Date.now() + "@falcon.pro";
        const [newUser] = await database.insert(db.users).values({
            email,
            username: email.split('@')[0],
            password: "SecurePassword123!",
            role: "user"
        }).returning();
        
        console.log("Created user:", newUser.id);
        
        // 2. Generate license
        const licenseKey = "FALCON-" + nanoid(16).toUpperCase();
        const [newLicense] = await database.insert(db.licenses).values({
            userId: newUser.id,
            licenseKey,
            type: "premium",
            maxAccounts: 10,
            maxMessagesPerAccount: 5000,
            durationDays: 30,
            status: "active",
            activatedAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            hardwareId: "TEST-LIVEMODE-HWID"
        }).returning();
        
        console.log("Generated and activated license:", licenseKey);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

setupLicense();
