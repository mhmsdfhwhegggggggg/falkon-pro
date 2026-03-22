import * as fs from 'fs';
import { telegramClientService } from './server/services/telegram-client.service';
import { Api } from 'telegram';
import { ultraExtractor } from './server/services/ultra-extractor';
import './scripts/load-env.js';

async function testAddUsers() {
    try {
        const sessionString = fs.readFileSync('final-session.txt', 'utf8');
        const accountId = 9; 
        
        const client = await telegramClientService.initializeClient(accountId, "+967712364131", sessionString);
        console.log("Internal Telegram Client initialized and connected.");
        
        // 1. Extract Members from a public group
        console.log("Extracting members from 'suldaj' channel...");
        const members = await ultraExtractor.extractMembers(client, accountId, "suldaj", { limit: 50 });
        console.log(`Extracted ${members.length} members. Target: 50`);
        
        // 2. Join the target group
        const targetGroupLink = "https://t.me/quotes_331";
        const targetGroupId = "quotes_331";
        
        console.log(`Joining target group: ${targetGroupLink}`);
        const joined = await telegramClientService.joinGroup(accountId, targetGroupLink);
        console.log(`Join group status: ${joined ? 'Success' : 'Failed or Already Joined'}`);
        
        // 3. Add Members to the target group
        console.log(`\n--- Starting to Add Members ---`);
        let addedCount = 0;
        
        for (const member of members) {
            console.log(`Analyzing member ID ${member.id} (${(member as any).firstName || 'Unknown'})...`);
            
            if (!member.username && !member.accessHash) {
                console.log(`⚠️ Skipping ${member.id} because they lack accessHash`);
                continue;
            }

            let success = false;
            try {
                const targetEntity = await client.getInputEntity(targetGroupLink);
                // If member exists, client.getInputEntity(member) uses its accessHash
                const userEntity = await client.getInputEntity(member.username ? member.username : member);
                
                await client.invoke(new Api.channels.InviteToChannel({
                    channel: targetEntity,
                    users: [userEntity]
                }));
                success = true;
            } catch (invErr) {
                console.warn(`Failed adding ${member.id}: ${(invErr as Error).message}`);
            }
            
            if (success) {
                console.log(`✅ Successfully added ${member.id}`);
                addedCount++;
            } else {
                console.log(`❌ Failed to add ${member.id} (they might have privacy settings restricting invites)`);
            }
            
            // Sleep to avoid flooding
            await new Promise(r => setTimeout(r, 2000));
        }
        
        console.log(`\n--- Summary ---`);
        console.log(`Successfully added ${addedCount} out of ${members.length} members to ${targetGroupId}.`);
        console.log(`Note: Failures are generally due to users disabling "Who can add me to groups" in their privacy settings.`);
        
        process.exit(0);
    } catch(e) {
        console.error("Add test failed:", e);
        process.exit(1);
    }
}
testAddUsers();
