import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import * as fs from "fs";

const apiId = 23515177;
const apiHash = "c0c57fbb7f328f1dd5dd1f9232a89a85";

const authData = JSON.parse(fs.readFileSync("auth.json", "utf8"));
const code = process.argv[2];
const password = process.argv[3]; // The 2FA password if required

if (!code) {
    console.error("Please provide the code as an argument");
    process.exit(1);
}

const stringSession = new StringSession(authData.sessionString);

(async () => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });
    
    await client.connect();
    
    try {
        await client.invoke(new Api.auth.SignIn({
            phoneNumber: authData.phoneNumber,
            phoneCodeHash: authData.phoneCodeHash,
            phoneCode: code
        }));
        
        console.log("Successfully logged in!");
        const finalSession = client.session.save();
        fs.writeFileSync("final-session.txt", finalSession as unknown as string);
        process.exit(0);
    } catch (e: any) {
        if (e.errorMessage === "SESSION_PASSWORD_NEEDED") {
            if (!password) {
                console.error("2FA Password is required for this account!");
                process.exit(2);
            }
            try {
                const passwordInfo = await client.invoke(new Api.account.GetPassword());
                const { computeCheck } = await import("telegram/Password.js");
                const checkPasswordSRP = await computeCheck(passwordInfo, password);
                await client.invoke(new Api.auth.CheckPassword({ password: checkPasswordSRP }));
                
                console.log("Successfully logged in with 2FA password!");
                const finalSession = client.session.save();
                fs.writeFileSync("final-session.txt", finalSession as unknown as string);
                process.exit(0);
            } catch (pwdError) {
                console.error("Failed to verify 2FA password:", pwdError);
                process.exit(1);
            }
        } else {
            console.error("Failed to sign in:", e);
            process.exit(1);
        }
    }
})();
