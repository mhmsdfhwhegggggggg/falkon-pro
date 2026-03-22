import "dotenv/config";
import { getDb, users, licenses } from "./server/db";
import { licenseManager } from "./server/services/license-manager";
import { desc, eq } from "drizzle-orm";

async function main() {
    const db = await getDb();
    if (!db) {
        console.error("No database connection");
        return;
    }

    // Get the most recently created user
    const recentUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(1);
    const user = recentUsers[0];
    
    if (!user) {
        console.error("No users found in database!");
        process.exit(1);
    }

    console.log(`Found target user: ID ${user.id} | Email: ${user.email}`);

    // Promote to admin
    await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
    console.log(`User ${user.id} promoted to Administrator.`);

    // Generate Master License
    const newLicense = await licenseManager.generateLicense({
        userId: user.id,
        type: "enterprise",
        durationDays: 3650, // 10 years
        maxAccounts: 100,
        maxMessages: 1000000,
        features: ["all"],
        autoRenew: false
    });

    console.log("\n=================================");
    console.log("🔥 MASTER LICENSE GENERATED 🔥");
    console.log("=================================");
    console.log("LICENSE KEY:");
    console.log(newLicense.licenseKey);
    console.log("=================================\n");

    process.exit(0);
}

main().catch(console.error);
