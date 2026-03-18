/**
 * Production High-Load Adder v4.0.0
 * 
 * The heavy-duty adder engine for massive scale:
 * - Multi-account Parallelism: Uses hundreds of accounts simultaneously.
 * - Server-Side Orchestration: No stress on user devices.
 * - Intelligent Cooldown: Automatically pauses accounts near their limits.
 * - Error Recovery: Handles privacy settings and already-in-group scenarios silently.
 * - High Speed: Optimized for adding thousands of users per hour safely.
 * 
 * @module ProductionAdder
 * @author Manus AI
 */

import { TelegramClient } from 'telegram';
import { Api } from 'telegram';
import { antiBanDistributed } from './anti-ban-distributed';
import { getAccountDistributor } from './account-distributor';

export class ProductionAdder {
  private static instance: ProductionAdder;

  private constructor() { }

  static getInstance(): ProductionAdder {
    if (!this.instance) {
      this.instance = new ProductionAdder();
    }
    return this.instance;
  }

  /**
   * Massive parallel addition logic
   */
  async massiveAdd(
    targetChatId: string,
    users: any[],
    accountIds: number[]
  ) {
    console.log(`[ProductionAdder] Starting massive addition of ${users.length} users using ${accountIds.length} accounts...`);

    const distributor = getAccountDistributor();
    const batchSize = Math.ceil(users.length / accountIds.length);

    // Distribute work across accounts
    const promises = accountIds.map(async (accountId, index) => {
      const userBatch = users.slice(index * batchSize, (index + 1) * batchSize);

      for (const user of userBatch) {
        // Schedule on server worker to keep mobile free
        await distributor.scheduleTask(accountId, 'add_user', {
          targetChatId,
          userId: user.id || user.username,
          userName: user.firstName
        });
      }
    });

    await Promise.all(promises);
    return { status: 'queued', message: 'Massive addition distributed to server workers' };
  }

  /**
   * Individual addition logic (Executed by Server Worker)
   */
  async executeSingleAdd(
    client: TelegramClient,
    accountId: number,
    targetChatId: string,
    userId: string
  ) {
    const safety = await antiBanDistributed.canPerformOperation(accountId, 'add_user');
    if (!safety.allowed) return { success: false, retryIn: safety.waitMs };

    try {
      await client.invoke(
        new Api.channels.InviteToChannel({
          channel: targetChatId,
          users: [userId],
        })
      );

      await antiBanDistributed.recordOperationResult(accountId, 'add_user', true);
      return { success: true };

    } catch (error: any) {
      const msg = error.message.toLowerCase();
      let errorType = 'other';

      if (msg.includes('flood')) errorType = 'flood';
      else if (msg.includes('privacy')) errorType = 'restriction';
      else if (msg.includes('banned')) errorType = 'ban';

      await antiBanDistributed.recordOperationResult(accountId, 'add_user', false, errorType as 'restriction' | 'spam' | 'flood' | 'ban' | 'network' | 'other');
      return { success: false, error: error.message, errorType };
    }
  }
}

export const productionAdder = ProductionAdder.getInstance();
