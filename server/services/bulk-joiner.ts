/**
 * Bulk Joiner Optimization v2.0.0
 * 
 * High-speed group/channel joiner:
 * - Smart delays to avoid "too many requests"
 * - Multi-account support
 * - Automatic link parsing (t.me, @username, private links)
 * - Anti-ban integration
 * 
 * @module BulkJoiner
 * @author Manus AI
 */

import { TelegramClient } from 'telegram';
import { Api } from 'telegram';
import { antiBanDistributed } from './anti-ban-distributed';

export class BulkJoiner {
  private static instance: BulkJoiner;

  private constructor() { }

  static getInstance(): BulkJoiner {
    if (!this.instance) {
      this.instance = new BulkJoiner();
    }
    return this.instance;
  }

  /**
   * Join a group or channel with smart protection
   */
  async joinChat(
    client: TelegramClient,
    accountId: number,
    chatIdentifier: string // username or invite link
  ) {
    // 1. Anti-Ban Check
    const check = await antiBanDistributed.canPerformOperation(accountId, 'join_group');
    if (!check.allowed) {
      return { success: false, reason: 'rate_limited', waitMs: check.waitMs };
    }

    try {
      console.log(`[BulkJoiner] Account ${accountId} joining ${chatIdentifier}...`);

      if (chatIdentifier.includes('t.me/joinchat/') || chatIdentifier.includes('t.me/+')) {
        // Private invite link
        const hash = chatIdentifier.split('/').pop()?.replace('+', '');
        if (hash) {
          await client.invoke(new Api.messages.ImportChatInvite({ hash }));
        }
      } else {
        // Public username or link
        const username = chatIdentifier.replace('https://t.me/', '').replace('@', '');
        await client.invoke(new Api.channels.JoinChannel({ channel: username }));
      }

      await antiBanDistributed.recordOperationResult(accountId, 'join_group', true);
      return { success: true };

    } catch (error: any) {
      const errorType = error.message.includes('FLOOD') ? 'flood' : 'other';
      await antiBanDistributed.recordOperationResult(accountId, 'join_group', false, errorType);

      return { success: false, reason: error.message };
    }
  }
}

export const bulkJoiner = BulkJoiner.getInstance();
