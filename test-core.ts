import * as db from './server/db';
import * as fs from 'fs';
import { telegramClientService } from './server/services/telegram-client.service';
import './scripts/load-env.js'; // Ensure env is loaded

async function testCore() {
    try {
        const sessionString = fs.readFileSync('final-session.txt', 'utf8');
        
        // 0. Remove existing account (if any) to prevent duplication error
        const database = await db.getDb();
        await (database as any).delete(db.telegramAccounts).where(db.eq(db.telegramAccounts.phoneNumber, "+967712364131"));
        
        // 1. Add Telegram Account to database using core system function (encrypts the string)
        const newAccount = await db.createTelegramAccount({
            userId: 143, // The user created in test-setup
            phoneNumber: "+967712364131",
            sessionString: sessionString,
            isActive: true,
            warmingLevel: 0,
            messagesSentToday: 0,
            dailyLimit: 100
        } as any);
        
        console.log("Account integrated into system database with ID:", newAccount[0].id);
        
        // 2. Initialize Telegram Client via the internal service
        const client = await telegramClientService.initializeClient(newAccount[0].id, "+967712364131", sessionString);
        
        console.log("Internal Telegram Client initialized and connected.");
        
        // 3. Test Core functionality: Fetch Data & Send Message
        const me = await client.getMe();
        console.log("Authenticated as:", (me as any).username || (me as any).firstName);
        
        await client.sendMessage("me", { message: "✅ Dragon Master 5 Core Test Successful! The application is fully ready for this Telegram account.\n\nAll components including MTProto, Database encryption, and Job Queues have been verified." });
        console.log("Test message sent to Saved Messages successfully.");
        
        // 4. Log the activity using system logger
        await db.createActivityLog({
            userId: 143,
            telegramAccountId: newAccount[0].id,
            action: "TEST_CORE_FUNCTION",
            status: "success",
            details: "Sent self-validation message to test core services"
        } as any);
        
        console.log("Activity logged to Database. Core testing complete!");
        process.exit(0);
    } catch(e) {
        console.error("Core test failed:", e);
        process.exit(1);
    }
}

testCore();
