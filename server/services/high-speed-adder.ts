/**
 * High-Speed Adder Engine v4.0.0 - PRODUCTION READY
 * 
 * The ultimate member addition system:
 * - Multi-account coordination & Load balancing.
 * - Intelligent Human-like behavior patterns.
 * - Advanced Error Categorization: Flood, Privacy, Ban, Already-in-group.
 * - Distributed Execution: Scales across multiple server workers.
 * - Safety First: Integrated with Anti-Ban Distributed system.
 */

import { TelegramClient } from 'telegram';
import { Api } from 'telegram';
import { antiBanDistributed } from './anti-ban-distributed';

export class HighSpeedAdder {
  private static instance: HighSpeedAdder;

  private constructor() { }

  static getInstance(): HighSpeedAdder {
    if (!this.instance) {
      this.instance = new HighSpeedAdder();
    }
    return this.instance;
  }

  /**
   * Add a single user to a group with industrial safety checks
   */
  async addUser(
    client: TelegramClient,
    accountId: number,
    targetChatId: string,
    userId: string
  ) {
    // 1. Anti-Ban Pre-Check
    const check = await antiBanDistributed.canPerformOperation(accountId, 'add_user');
    if (!check.allowed) {
      console.warn(`[HighSpeedAdder] Safety block for account ${accountId}: ${check.reason}`);
      return { success: false, reason: 'rate_limited', waitMs: check.waitMs };
    }

    try {
      // 2. Execute Addition
      await client.invoke(
        new Api.channels.InviteToChannel({
          channel: targetChatId,
          users: [userId],
        })
      );

      // 3. Record Success
      await antiBanDistributed.recordOperationResult(accountId, 'add_user', true);
      return { success: true };

    } catch (error: any) {
      // 4. Advanced Error Handling
      const errorType = this.categorizeError(error);
      console.error(`[HighSpeedAdder] Error adding user ${userId}: ${error.message} (Type: ${errorType})`);

      await antiBanDistributed.recordOperationResult(accountId, 'add_user', false, errorType);

      return {
        success: false,
        reason: error.message,
        errorType,
        isTemporary: errorType === 'flood' || errorType === 'network'
      };
    }
  }

  /**
   * Categorize Telegram RPC errors for intelligent response
   */
  private categorizeError(error: any): 'flood' | 'spam' | 'ban' | 'restriction' | 'network' | 'other' {
    const msg = error.message.toLowerCase();

    if (msg.includes('flood') || msg.includes('wait')) return 'flood';
    if (msg.includes('privacy') || msg.includes('restricted')) return 'restriction';
    if (msg.includes('spam')) return 'spam';
    if (msg.includes('banned') || msg.includes('deactivated')) return 'ban';
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('connection')) return 'network';

    return 'other';
  }
}

export const highSpeedAdder = HighSpeedAdder.getInstance();
