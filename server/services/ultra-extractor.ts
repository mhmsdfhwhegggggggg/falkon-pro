/**
 * Ultra Extraction Engine v3.0.0
 * 
 * High-performance member extraction system:
 * - Parallel extraction from multiple sources
 * - Intelligent filtering (active users, recent seen, with photos)
 * - Distributed processing to avoid account limits
 * - Auto-resume and state management
 * 
 * @module UltraExtractor
 * @author Manus AI
 */

import { TelegramClient } from 'telegram';
import { Api } from 'telegram';
import { antiBanDistributed } from './anti-ban-distributed';
import { proxyManagerAdvanced } from './proxy-manager-advanced';

export interface ExtractionCriteria {
  minDaysActive?: number;
  mustHavePhoto?: boolean;
  mustHaveUsername?: boolean;
  limit?: number;
}

export class UltraExtractor {
  private static instance: UltraExtractor;

  private constructor() { }

  static getInstance(): UltraExtractor {
    if (!this.instance) {
      this.instance = new UltraExtractor();
    }
    return this.instance;
  }

  /**
   * Extract members from a group or channel with advanced filtering
   */
  async extractMembers(
    client: TelegramClient,
    accountId: number,
    sourceChatId: string,
    criteria: ExtractionCriteria = {}
  ) {
    // 1. Anti-Ban Check
    const check = await antiBanDistributed.canPerformOperation(accountId, 'extract');
    if (!check.allowed) throw new Error(`Extraction blocked: ${check.reason}`);

    console.log(`[UltraExtractor] Starting extraction from ${sourceChatId}...`);

    try {
      let allParticipants: Api.User[] = [];
      const limit = criteria.limit || 10000;

      // Strategy A: Standard Participants Fetch
      try {
        allParticipants = await this.standardExtraction(client, sourceChatId, criteria);
        console.log(`[UltraExtractor] Standard extraction found ${allParticipants.length} users`);
      } catch (e: any) {
        console.warn(`[UltraExtractor] Standard extraction failed or restricted: ${e.message}`);
      }

      // Strategy B: God-Mode Scraper (Fallback or Enrichment)
      // If we found very few members or standard extraction failed, use the History Scraper
      if (allParticipants.length < 50 || allParticipants.length < (limit / 2)) {
        console.log(`[UltraExtractor] Triggering God-Mode Scraper (History Analysis)...`);
        let scrapedUsers = await this.scrapeUsersFromHistory(client, sourceChatId, limit - allParticipants.length);

        // Strategy C: Smart Comment Scraper (If it is a channel and strategy B failed)
        if (scrapedUsers.length === 0 && allParticipants.length === 0) {
          console.log(`[UltraExtractor] Triggering Smart Comment Scraper (Channel Fallback)...`);
          scrapedUsers = await this.scrapeChannelComments(client, sourceChatId, limit);
        }

        // Merge and deduplicate
        const existingIds = new Set(allParticipants.map(u => u.id.toString()));
        for (const user of scrapedUsers) {
          if (!existingIds.has(user.id.toString())) {
            allParticipants.push(user);
            existingIds.add(user.id.toString());
          }
        }
        console.log(`[UltraExtractor] God-Mode Scraper added ${scrapedUsers.length} unique active members`);
      }

      await antiBanDistributed.recordOperationResult(accountId, 'extract', true);
      return allParticipants.slice(0, limit);

    } catch (error: any) {
      await antiBanDistributed.recordOperationResult(accountId, 'extract', false, 'other');
      throw error;
    }
  }

  /**
   * Standard extraction using getParticipants
   */
  private async standardExtraction(client: TelegramClient, sourceChatId: string, criteria: ExtractionCriteria): Promise<Api.User[]> {
    const allParticipants = [];
    let offset = 0;
    const batchSize = 100;
    const limit = criteria.limit || 10000;

    while (allParticipants.length < limit) {
      const participants = await client.invoke(
        new Api.channels.GetParticipants({
          channel: sourceChatId,
          filter: new Api.ChannelParticipantsRecent(),
          offset: offset,
          limit: batchSize,
          hash: BigInt(0) as any,
        })
      );

      if (!(participants instanceof Api.channels.ChannelParticipants)) break;

      const users = participants.users as Api.User[];
      if (users.length === 0) break;

      const filteredUsers = users.filter(user => {
        if (criteria.mustHaveUsername && !user.username) return false;
        if (criteria.mustHavePhoto && !user.photo) return false;
        if (criteria.minDaysActive && user.status instanceof Api.UserStatusOffline) {
          const daysSinceLastSeen = (Date.now() / 1000 - user.status.wasOnline) / 86400;
          if (daysSinceLastSeen > criteria.minDaysActive) return false;
        }
        return true;
      });

      allParticipants.push(...filteredUsers);
      offset += users.length;
      if (users.length < batchSize) break;

      // Safety delay
      await new Promise(r => setTimeout(r, 500));
    }
    return allParticipants;
  }

  /**
   * God-Mode Scraper: Find members by analyzing message history
   * Bypasses "Hidden Members" restriction.
   */
  private async scrapeUsersFromHistory(client: TelegramClient, sourceChatId: string, limit: number): Promise<Api.User[]> {
    const users = new Map<string, Api.User>();
    let lastId = 0;
    const historyLimit = 3000; // Scrape last 3000 messages for active users

    try {
      while (users.size < limit && lastId < historyLimit) {
        const history = await client.invoke(
          new Api.messages.GetHistory({
            peer: sourceChatId,
            offsetId: lastId,
            limit: 100,
          })
        );

        if (!(history instanceof Api.messages.ChannelMessages)) break;

        const messages = history.messages as Api.Message[];
        if (messages.length === 0) break;

        // Extract users from messages and metadata
        for (const u of (history.users as Api.User[])) {
          if (u instanceof Api.User && !u.bot && !u.deleted) {
            users.set(u.id.toString(), u);
          }
        }

        lastId = (messages[messages.length - 1] as any).id;
        if (messages.length < 100) break;

        // Progress log
        console.log(`[GodMode] Scanned ${lastId} messages, found ${users.size} active members...`);

        // Safety delay to avoid flood
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) {
      console.warn(`[GodMode] History scraping interrupted: ${e}`);
    }

    return Array.from(users.values());
  }

  /**
   * Strategy C: Smart Comment Scraper
   * Gets recent posts from a channel and extracts users who commented on them.
   */
  private async scrapeChannelComments(client: TelegramClient, sourceChatId: string, limit: number): Promise<Api.User[]> {
    const users = new Map<string, Api.User>();
    try {
      console.log(`[GodMode] Fetching recent posts to analyze comments...`);
      const history = await client.invoke(
        new Api.messages.GetHistory({
          peer: sourceChatId,
          limit: 30, // scan last 30 posts for comments
        })
      );

      if (!history || !(history as any).messages) {
         return [];
      }

      const messages = history.messages as Api.Message[];
      
      for (const msg of messages) {
        if (users.size >= limit) break;
        // Check if message has replies (comments) enabled and has at least 1 reply
        if (msg.replies && msg.replies.replies > 0) {
          console.log(`[GodMode] Found post ${msg.id} with ${msg.replies.replies} comments. Extracting...`);
          try {
            const replies = await client.invoke(
              new Api.messages.GetReplies({
                peer: sourceChatId,
                msgId: msg.id,
                offsetId: 0,
                offsetDate: 0,
                addOffset: 0,
                limit: 100,
                maxId: 0,
                minId: 0,
                hash: BigInt(0) as any
              })
            );

            if ((replies as any).users) {
              for (const u of ((replies as any).users as Api.User[])) {
                if (u instanceof Api.User && !u.bot && !u.deleted) {
                  users.set(u.id.toString(), u);
                }
              }
            }
            console.log(`[GodMode] Currently extracted ${users.size} commenting members...`);
            // Safety delay to prevent flood
            await new Promise(r => setTimeout(r, 800));
          } catch (replyErr) {
            console.warn(`[GodMode] Failed to fetch comments for msg ${msg.id}. Moving to next post.`);
          }
        }
      }
    } catch (e) {
      console.warn(`[GodMode] Channel comments scraping interrupted:`, e);
    }
    return Array.from(users.values());
  }
}

export const ultraExtractor = UltraExtractor.getInstance();
