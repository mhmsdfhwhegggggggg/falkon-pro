import * as db from './server/db';
import { eq } from 'drizzle-orm';

async function checkProd() {
    try {
        const database = await db.getDb();
        if (!database) {
            console.error("Database connection failed.");
            process.exit(1);
        }
        
        console.log("Database connection successful.");
        
        // Check for admin user
        const users = await database.select().from(db.users).limit(10);
        console.log("Users in DB:", users.map((u: any) => ({ id: u.id, email: u.email, role: u.role })));
        
        // Count telegram accounts
        const accounts = await database.select().from(db.telegramAccounts);
        console.log("Telegram Accounts count:", accounts.length);
        
        // Output counts
        const logs = await database.select().from(db.activityLogs).limit(5);
        console.log("Logs count (top 5):", logs.length);
        
        console.log("Everything seems readable from production DB!");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkProd();
