/**
 * Industrial Extractor - High-performance member extraction
 * Optimized for massive scale extraction with server-side filtering
 */

import { TelegramClient } from 'telegram';
import { Api } from 'telegram';
import { antiBanDistributed } from './anti-ban-distributed';
import { getCache } from '../_core/cache-system';

export interface IndustrialFilters {
  activityDays?: number;
  hasPhoto?: boolean;
  hasUsername?: boolean;
  premiumStatus?: boolean;
  limit?: number;
}

export class IndustrialExtractor {
  private static instance: IndustrialExtractor;
  private cache = getCache();

  private constructor() { }

  static getInstance(): IndustrialExtractor {
    if (!this.instance) {
      this.instance = new IndustrialExtractor();
    }
    return this.instance;
  }

  /**
   * Industrial extraction with high-speed server-side processing
   */
  async industrialExtract(
    client: TelegramClient,
    accountId: number,
    sourceId: string,
    filters: IndustrialFilters = {},
    onDataBatch?: (users: any[]) => Promise<void>
  ) {
    // 1. Safety Check
    const check = await antiBanDistributed.canPerformOperation(accountId, 'extract');
    if (!check.allowed) throw new Error(`Industrial Safety: ${check.reason}`);

    console.log(`[IndustrialExtractor] Starting massive extraction for ${sourceId}...`);

    try {
      // 2. Resolve Entity with fallback logic
      let target;
      try {
        target = await client.getEntity(sourceId);
      } catch (e) {
        console.log(`[IndustrialExtractor] Fallback to getInputEntity for ${sourceId}`);
        target = await client.getInputEntity(sourceId);
      }

      let offset = 0;
      const limit = filters.limit || 1000000; // Support up to 1M members
      const batchSize = 100;
      let count = 0;
      let consecutiveErrors = 0;

      // 3. Extraction Loop
      while (count < limit) {
        try {
          const result = await client.invoke(
            new Api.channels.GetParticipants({
              channel: target,
              filter: new Api.ChannelParticipantsRecent(),
              offset: offset,
              limit: batchSize,
              hash: 0 as any,
            })
          );

          if (!(result instanceof Api.channels.ChannelParticipants)) break;

          const users = result.users as Api.User[];
          if (users.length === 0) break;

          // 4. Server-Side Filtering (High Performance)
          const processed = users.filter(u => {
            if (filters.hasUsername && !u.username) return false;
            if (filters.hasPhoto && !u.photo) return false;
            if (filters.premiumStatus && !u.premium) return false;

            if (filters.activityDays && u.status instanceof Api.UserStatusOffline) {
              const days = (Date.now() / 1000 - u.status.wasOnline) / 86400;
              if (days > filters.activityDays) return false;
            }
            return true;
          }).map(u => ({
            id: u.id.toString(),
            username: u.username,
            firstName: u.firstName,
            lastName: u.lastName,
            isBot: u.bot,
            isPremium: u.premium,
            lastSeen: u.status instanceof Api.UserStatusOffline ? u.status.wasOnline : null,
          }));

          // 5. Batch Processing
          if (onDataBatch) {
            await onDataBatch(processed);
          }

          count += processed.length;
          offset += batchSize;
          consecutiveErrors = 0;

          // 6. Progress Update
          if (count % 1000 === 0) {
            console.log(`[IndustrialExtractor] Extracted ${count} members...`);
          }

          // 7. Smart Delay
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error: any) {
          consecutiveErrors++;
          console.error(`[IndustrialExtractor] Extraction error: ${error.message}`);

          if (consecutiveErrors >= 3) {
            throw new Error(`Industrial extraction failed after ${consecutiveErrors} consecutive errors`);
          }

          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, consecutiveErrors) * 1000));
        }
      }

      console.log(`[IndustrialExtractor] Extraction completed: ${count} members`);
      return count;

    } catch (error) {
      console.error(`[IndustrialExtractor] Industrial extraction failed:`, error);
      throw error;
    }
  }
}

export const industrialExtractor = IndustrialExtractor.getInstance();
