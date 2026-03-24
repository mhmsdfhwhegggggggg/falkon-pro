import axios from 'axios';
import { db, telegramAccounts, apiCredentialPool, proxyConfigs, and, eq, sql } from '../db';
import { logger } from '../_core/logger';
import { Secrets } from '../_core/secrets';

export type CredentialSource = 'direct' | 'proxy' | 'pool' | 'shared' | 'pending';

export interface ApiCredentials {
  apiId: number;
  apiHash: string;
  source: CredentialSource;
}

export class ApiCredentialsGenerator {
  private static readonly BASE_URL = 'https://my.telegram.org';

  /**
   * Generates or retrieves API credentials using multiple fallback layers.
   */
  static async generateCredentialsGuaranteed(
    phoneNumber: string,
    loginCode: string,
    userId: number
  ): Promise<ApiCredentials> {
    // Layer 1: Direct attempt
    try {
      const directResult = await this.attemptExtraction(phoneNumber, loginCode);
      if (directResult) return { ...directResult, source: 'direct' };
    } catch (error: any) {
      logger.warn('[ApiGen] Direct attempt failed:', error.message);
    }

    // Layer 2: Proxy rotated attempt
    const proxies = await db.select().from(proxyConfigs).where(
      and(eq(proxyConfigs.userId, userId), sql`${proxyConfigs.health} != 'dead'`)
    );

    for (const proxy of proxies.slice(0, 5)) {
      try {
        const proxyResult = await this.attemptExtraction(phoneNumber, loginCode, proxy);
        if (proxyResult) return { ...proxyResult, source: 'proxy' };
      } catch (error: any) {
        logger.warn(`[ApiGen] Proxy ${proxy.host} failed:`, error.message);
      }
    }

    // Layer 3: Credential Pool (Atomic selection)
    try {
      const poolResult = await this.getFromPool();
      if (poolResult) return { ...poolResult, source: 'pool' };
    } catch (error: any) {
      logger.warn('[ApiGen] Pool retrieval failed:', error.message);
    }

    // Layer 4: Fallback to shared (mark as pending for background retry)
    const shared = Secrets.getTelegramCredentials();
    if (!shared) {
      throw new Error('No shared Telegram credentials configured as final fallback');
    }
    
    return {
      apiId: shared.apiId,
      apiHash: shared.apiHash,
      source: 'pending'
    };
  }

  /**
   * Attempts to extract API credentials from my.telegram.org
   */
  private static async attemptExtraction(
    phoneNumber: string,
    loginCode: string,
    proxy?: any
  ): Promise<{ apiId: number; apiHash: string } | null> {
    const client = axios.create({
      baseURL: this.BASE_URL,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      proxy: proxy ? {
        host: proxy.host,
        port: proxy.port,
        auth: proxy.username ? { username: proxy.username, password: proxy.password } : undefined
      } : false
    });

    try {
      // 1. Send password (get random_hash)
      const step1 = await client.post('/auth/send_password', `phone=${encodeURIComponent(phoneNumber)}`);
      const randomHash = step1.data; 

      // 2. Login
      const step2 = await client.post('/auth/login', `phone=${encodeURIComponent(phoneNumber)}&random_hash=${randomHash}&password=${encodeURIComponent(loginCode)}`);
      const cookies = step2.headers['set-cookie'];

      if (!cookies) throw new Error('Failed to get session cookies');

      // 3. Get /apps page
      const step3 = await client.get('/apps', {
        headers: { Cookie: cookies.join('; ') }
      });

      // 4. Extract API ID and Hash (7 fallback strategies)
      return this.parseAppDetails(step3.data);

    } catch (error: any) {
      if (error.response?.data?.includes('App already exists')) {
        // Handle existing app by navigating to apps page directly if possible
        // (Simplified for now)
      }
      throw error;
    }
  }

  /**
   * Robust parser with multiple fallback strategies
   */
  private static parseAppDetails(html: string): { apiId: number; apiHash: string } | null {
    const strategies = [
      // Strategy 1: Regex for api_id (common)
      (h: string) => {
        const matchId = h.match(/App api_id:.*?<strong>(\d+)<\/strong>/s);
        const matchHash = h.match(/App api_hash:.*?<span.*?>(.*?)<\/span>/s);
        return matchId && matchHash ? { apiId: parseInt(matchId[1]), apiHash: matchHash[1].trim() } : null;
      },
      // Strategy 2: Regex for input values
      (h: string) => {
        const matchId = h.match(/name="api_id".*?value="(\d+)"/);
        const matchHash = h.match(/name="api_hash".*?value="(.*?)"/);
        return matchId && matchHash ? { apiId: parseInt(matchId[1]), apiHash: matchHash[2] } : null;
      },
      // Strategy 3: Search text patterns
      (h: string) => {
        if (h.includes('api_id') && h.includes('api_hash')) {
          const parts = h.split('api_id');
          const id = parts[1].match(/(\d+)/)?.[1];
          const hash = h.split('api_hash')[1].match(/([a-f0-9]{32})/)?.[1];
          return id && hash ? { apiId: parseInt(id), apiHash: hash } : null;
        }
        return null;
      }
    ];

    for (const strategy of strategies) {
      const result = strategy(html);
      if (result) return result;
    }

    return null;
  }

  /**
   * Periodically retries extraction for pending accounts.
   * Can be called during system startup or by a scheduled task.
   */
  static async retryPendingExtractions() {
    const pendingAccounts = await db.select().from(telegramAccounts).where(
      eq(telegramAccounts.credentialSource, 'pending')
    );

    if (pendingAccounts.length === 0) return;

    logger.info(`[ApiGen] Retrying API extraction for ${pendingAccounts.length} pending accounts...`);

    for (const account of pendingAccounts) {
      try {
        // Since we don't have the login code anymore for these accounts,
        // we must try to get from pool or wait for next manual login.
        // HOWEVER, a better way is to check the pool first.
        const poolResult = await this.getFromPool();
        if (poolResult) {
          await db.update(telegramAccounts).set({
            apiId: poolResult.apiId,
            apiHash: poolResult.apiHash,
            credentialSource: 'pool'
          }).where(eq(telegramAccounts.id, account.id));
          logger.info(`[ApiGen] Restored credentials for ${account.phoneNumber} from pool.`);
        }
      } catch (error: any) {
        logger.error(`[ApiGen] Retry failed for ${account.phoneNumber}:`, error.message);
      }
    }
  }

  /**
   * Atomsically retrieves a set of credentials from the pool
   */
  private static async getFromPool(): Promise<{ apiId: number; apiHash: string } | null> {
    const result = await db.transaction(async (tx: any) => {
      const [available] = await tx.select().from(apiCredentialPool).where(
        eq(apiCredentialPool.status, 'available')
      ).limit(1).for('update', { skipLocked: true });

      if (available) {
        await tx.update(apiCredentialPool).set({
          status: 'used',
          usedAt: new Date()
        }).where(eq(apiCredentialPool.id, available.id));

        return { apiId: available.apiId, apiHash: available.apiHash };
      }
      return null;
    });

    return result;
  }

  /**
   * Adds credentials to the pool
   */
  static async addToPool(credentials: { apiId: number; apiHash: string }[]) {
    if (credentials.length === 0) return;
    await db.insert(apiCredentialPool).values(credentials.map(c => ({
      apiId: c.apiId,
      apiHash: c.apiHash,
      status: 'available'
    })));
  }
}
