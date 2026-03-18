import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query: string): Promise<string> => new Promise(resolve => rl.question(query, resolve));

async function startLogin() {
    const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
    const apiHash = process.env.TELEGRAM_API_HASH || "";
    const phoneNumber = process.argv[2] || "+967712364131";

    console.log(`[Debug] API_ID: ${apiId}`);
    console.log(`[Debug] API_HASH: ${apiHash}`);
    console.log(`[Debug] Phone: ${phoneNumber}`);

    if (!apiId || !apiHash) {
        throw new Error("TELEGRAM_API_ID or TELEGRAM_API_HASH is missing");
    }

    const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
        connectionRetries: 5,
        useWSS: false // Try standard TCP first
    });

    console.log("[Test] Connecting to Telegram...");
    await client.connect();
    console.log("[Test] Connected!");

    try {
        await client.start({
            phoneNumber: async () => phoneNumber,
            password: async () => await question("Please enter your 2FA password (if any): "),
            phoneCode: async () => await question("Please enter the code you received: "),
            onError: (err) => console.error("[Test] Client Start Error:", err.message),
        });

        const sessionString = (client.session as any).save();
        console.log("\n[SUCCESS] Login complete!");
        console.log("[SUCCESS] Session String:", sessionString);
        console.log("\n[INFO] You can now add this session string to the database.");
    } catch (err: any) {
        console.error("\n[ERROR] Login failed:", err.message);
        if (err.message.includes("API_ID_INVALID")) {
            console.error("[TIP] Please double-check your API_ID and API_HASH at my.telegram.org");
        }
    } finally {
        await client.disconnect();
        rl.close();
    }
}

startLogin().catch(err => {
    console.error("[Fatal] Error:", err.message);
    process.exit(1);
});
