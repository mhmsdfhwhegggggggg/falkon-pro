import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";

// Use environment variables for API credentials
// For React Native (Expo), you typically use expo-constants or env variables prefixed with EXPO_PUBLIC_
const API_ID = parseInt(process.env.EXPO_PUBLIC_TELEGRAM_API_ID || "2209670");
const API_HASH = process.env.EXPO_PUBLIC_TELEGRAM_API_HASH || "6ebcf5e1efad36fcfff77c08abfc09b8";

export class LocalTelegramService {
  private client: TelegramClient | null = null;
  private sessionString: string;

  constructor(session: string = "") {
    this.sessionString = session;
  }

  /**
   * Initialize and connect the Telegram client using WSS
   */
  async init() {
    if (this.client) return this.client;

    const stringSession = new StringSession(this.sessionString);
    this.client = new TelegramClient(stringSession, API_ID, API_HASH, {
      connectionRetries: 5,
      useWSS: true, // Use WebSockets instead of TCP for React Native compatibility
      deviceModel: "Falkon Pro (Mobile)",
      systemVersion: "1.0",
      appVersion: "1.0",
    });

    await this.client.connect();
    return this.client;
  }

  /**
   * Request login code
   */
  async sendCode(phoneNumber: string) {
    if (!this.client) await this.init();
    const result = await this.client!.sendCode(
      { apiId: API_ID, apiHash: API_HASH },
      phoneNumber
    );
    return result.phoneCodeHash;
  }

  /**
   * Confirm login code and get session string
   */
  async signIn(phoneNumber: string, phoneCodeHash: string, code: string, password?: string) {
    if (!this.client) await this.init();
    
    try {
      await this.client!.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash,
          phoneCode: code,
        })
      );
    } catch (e: any) {
      if (e.message.includes("SESSION_PASSWORD_NEEDED") && password) {
        await this.client!.signInWithPassword(
          { apiId: API_ID, apiHash: API_HASH },
          { password: async () => password, onError: (err) => { throw err; } }
        );
      } else {
        throw e;
      }
    }

    const newSession = (this.client!.session as StringSession).save();
    return newSession;
  }

  /**
   * Disconnect the client
   */
  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }
}
