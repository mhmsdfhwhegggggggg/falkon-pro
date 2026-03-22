import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import * as fs from 'fs';

const apiId = 23515177; // From .env
const apiHash = "c0c57fbb7f328f1dd5dd1f9232a89a85"; // From .env
const phoneNumber = "+967712364131";

const stringSession = new StringSession("");

(async () => {
    console.log("Loading interactive example...");
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });
    
    await client.connect();
    
    try {
        const result = await client.sendCode(
            {
                apiId,
                apiHash,
            },
            phoneNumber
        );
        
        console.log("Code sent successfully!");
        
        fs.writeFileSync("auth.json", JSON.stringify({
            phoneCodeHash: result.phoneCodeHash,
            phoneNumber: phoneNumber,
            sessionString: client.session.save(),
        }));
        
        console.log("Saved auth state to auth.json.");
        process.exit(0);
    } catch (e) {
        console.error("Failed to send code:", e);
        process.exit(1);
    }
})();
