import * as db from './server/db';
import * as fs from 'fs';
import { telegramClientService } from './server/services/telegram-client.service';
import './scripts/load-env.js';

async function testExtract() {
    try {
        const sessionString = fs.readFileSync('final-session.txt', 'utf8');
        
        const accountId = 9; // Account ID generated in previous step
        
        const client = await telegramClientService.initializeClient(accountId, "+967712364131", sessionString);
        console.log("Internal Telegram Client initialized and connected.");
        
        const channelLink = "https://t.me/misteradaminglizi";
        
        console.log("Joining channel:", channelLink);
        const joined = await telegramClientService.joinGroup(accountId, channelLink);
        if (!joined) {
            console.log("Failed to join or already joined.");
        } else {
            console.log("Joined successfully.");
        }
        
        console.log("Extracting members...");
        const members = await telegramClientService.extractGroupMembers(accountId, "misteradaminglizi");
        
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
testExtract();
