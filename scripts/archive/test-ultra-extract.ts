import * as db from './server/db';
import * as fs from 'fs';
import { telegramClientService } from './server/services/telegram-client.service';
import { ultraExtractor } from './server/services/ultra-extractor';
import './scripts/load-env.js';

async function testUltraExtract() {
    try {
        const sessionString = fs.readFileSync('final-session.txt', 'utf8');
        const accountId = 9; // Account ID generated in previous step
        
        const client = await telegramClientService.initializeClient(accountId, "+967712364131", sessionString);
        console.log("Internal Telegram Client initialized and connected.");
        
        const channelLink = "https://t.me/durov";
        
        console.log("Joining channel:", channelLink);
        await telegramClientService.joinGroup(accountId, channelLink);
        
        console.log("Running Ultra Extractor (God-Mode)...");
        const members = await ultraExtractor.extractMembers(client, accountId, "durov", { limit: 100 });
        
        console.log(`Extracted total ${members.length} members.`);
        
        const top5 = members.slice(0, 5);
        console.log("\n--- Top 5 Members Extracted ---");
        top5.forEach((m: any, i: number) => {
            console.log(`${i+1}. ID: ${m.id}, Username: ${m.username || 'N/A'}, Name: ${m.firstName || ''} ${m.lastName || ''}`);
        });
        console.log("-------------------------------\n");
        
        process.exit(0);
    } catch(e) {
        console.error("Extraction test failed:", e);
        process.exit(1);
    }
}
testUltraExtract();
