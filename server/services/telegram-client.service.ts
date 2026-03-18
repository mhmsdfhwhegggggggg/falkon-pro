import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import * as db from "../db";
import { Secrets } from "../_core/secrets";
import { entityResolver } from "./entity-resolver";

export class TelegramClientService {
  private static clients: Map<number, TelegramClient> = new Map();

  // ... (existing methods getApiCredentials, initializeClient, disconnectClient, getClient)

  /**
   * Add event handler to client
   */
  async addEventHandler(accountId: number, handler: (event: any) => Promise<void>, eventFilter: any): Promise<void> {
    const client = this.getClient(accountId);
    if (!client) {
      console.warn(`[TelegramClient] Client not found for account ${accountId}, cannot add handler`);
      return;
    }

    client.addEventHandler(handler, eventFilter);
    console.log(`[TelegramClient] Added event handler for account ${accountId}`);
  }

  /**
   * Get current user info (Me)
   */
  async getMe(accountId: number): Promise<Api.User | null> {
    const client = this.getClient(accountId);
    if (!client) return null;
    try {
      const me = await client.getMe();
      return me as Api.User;
    } catch (error) {
      console.error('Get Me error:', error);
      return null;
    }
  }

  // ... (existing methods extractGroupMembers, sendMessage)
  /**
   * Get API credentials from environment or secrets
   */
  getApiCredentials(): { apiId: number; apiHash: string } {
    const fromSecrets = Secrets.getTelegramCredentials();
    if (fromSecrets) return fromSecrets;
    return {
      apiId: parseInt(process.env.TELEGRAM_API_ID || "0"),
      apiHash: process.env.TELEGRAM_API_HASH || "",
    };
  }

  /**
   * Initialize Telegram client
   */
  async initializeClient(
    accountId: number,
    phoneNumber: string,
    sessionString: string,
    apiId?: number,
    apiHash?: string
  ): Promise<TelegramClient> {
    const credentials = apiId && apiHash ? { apiId, apiHash } : this.getApiCredentials();

    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, credentials.apiId, credentials.apiHash, {
      connectionRetries: 5,
      retryDelay: 2000,
    });

    await client.connect();

    // Store client for reuse
    TelegramClientService.clients.set(accountId, client);

    return client;
  }

  /**
   * Disconnect client
   */
  async disconnectClient(accountId: number): Promise<void> {
    const client = TelegramClientService.clients.get(accountId);
    if (client) {
      await client.disconnect();
      TelegramClientService.clients.delete(accountId);
    }
  }

  /**
   * Get existing client
   */
  getClient(accountId: number): TelegramClient | undefined {
    return TelegramClientService.clients.get(accountId);
  }

  /**
   * Extract group members with streaming
   */
  async extractGroupMembers(accountId: number, groupId: string): Promise<any[]> {
    const client = this.getClient(accountId);
    if (!client) throw new Error("Client not initialized");

    const entity = await entityResolver.resolveEntity(client, groupId);
    const members = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      try {
        const result = await client.invoke({
          _: 'channels.getParticipants',
          channel: entity,
          filter: { _: 'channelParticipantsRecent' },
          offset,
          limit,
          hash: BigInt(0)
        });

        if (!result || !(result as any).participants || (result as any).participants.length === 0) break;

        members.push(...(result as any).participants);
        offset += limit;

        // Smart delay
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error('Extraction error:', error);
        break;
      }
    }

    return members;
  }

  /**
   * Send message
   */
  async sendMessage(accountId: number, chatId: string, message: string, options: any = {}): Promise<Api.Message> {
    const client = this.getClient(accountId);
    if (!client) throw new Error("Client not initialized");

    try {
      const result = await client.sendMessage(chatId, {
        message: message,
        replyTo: options.replyTo,
        parseMode: 'html',
        ...options
      });
      return result;
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  }

  /**
   * Send reaction to a message
   */
  async sendReaction(accountId: number, chatId: string, messageId: number, reaction: string): Promise<boolean> {
    const client = this.getClient(accountId);
    if (!client) throw new Error("Client not initialized");

    try {
      // Resolve reaction object based on string (emoji)
      // Telegram expects ReactionEmoji or ReactionCustomEmoji
      // Simple emoji reaction:
      await client.invoke(new Api.messages.SendReaction({
        peer: chatId,
        msgId: messageId,
        reaction: [new Api.ReactionEmoji({ emoticon: reaction })]
      }));
      return true;
    } catch (error) {
      console.error('Send reaction error:', error);
      return false;
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(accountId: number, chatId: string, messageId: number | number[]): Promise<boolean> {
    const client = this.getClient(accountId);
    if (!client) throw new Error("Client not initialized");

    try {
      const messageIds = Array.isArray(messageId) ? messageId : [messageId];
      await client.invoke({
        _: 'channels.deleteMessages',
        channel: chatId,
        id: messageIds
      } as any);
      return true;
    } catch (error) {
      console.error('Delete message error:', error);
      // Fallback for non-channel chats
      try {
        const messageIds = Array.isArray(messageId) ? messageId : [messageId];
        await client.invoke({
          _: 'messages.deleteMessages',
          id: messageIds,
          revoke: true
        } as any);
        return true;
      } catch (e) {
        console.error('Fallback delete message error:', e);
        throw error;
      }
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(accountId: number, chatId: string, messageId: number): Promise<boolean> {
    const client = this.getClient(accountId);
    if (!client) throw new Error("Client not initialized");

    try {
      await client.invoke({
        _: 'messages.readHistory',
        peer: chatId,
        maxId: messageId
      } as any);
      return true;
    } catch (error) {
      console.error('Mark as read error:', error);
      throw error;
    }
  }

  /**
   * Get member info from group
   */
  async getParticipantInfo(accountId: number, groupId: string, participantId: string): Promise<any> {
    const client = this.getClient(accountId);
    if (!client) throw new Error("Client not initialized");

    try {
      const result = await client.invoke({
        _: 'channels.getParticipant',
        channel: groupId,
        participant: participantId
      } as any);
      return (result as any).participant;
    } catch (error) {
      console.error('Get participant info error:', error);
      return null;
    }
  }

  /**
   * Join a group or channel
   */
  async joinGroup(accountId: number, groupLink: string): Promise<boolean> {
    const client = this.getClient(accountId);
    if (!client) throw new Error("Client not initialized");

    try {
      if (groupLink.includes('t.me/joinchat/') || groupLink.includes('t.me/+')) {
        const hash = groupLink.split('/').pop()?.replace('+', '');
        await client.invoke(new Api.messages.ImportChatInvite({ hash: hash! }));
      } else {
        const username = groupLink.split('/').pop();
        await client.invoke(new Api.channels.JoinChannel({ channel: username! }));
      }
      return true;
    } catch (error) {
      console.error('Join group error:', error);
      return false;
    }
  }

  /**
   * Add user to group
   */
  async addUserToGroup(accountId: number, groupId: string, userId: string): Promise<boolean> {
    const client = this.getClient(accountId);
    if (!client) throw new Error("Client not initialized");

    try {
      const entity = await entityResolver.resolveEntity(client, groupId);
      const userEntity = await entityResolver.resolveEntity(client, userId);

      await client.invoke(new Api.channels.InviteToChannel({
        channel: entity,
        users: [userEntity]
      }));
      return true;
    } catch (error) {
      console.error('Add user error:', error);
      return false;
    }
  }

  /**
   * Extract engaged members (filtered by last seen)
   */
  async extractEngagedMembers(accountId: number, groupId: string, daysActive: number): Promise<any[]> {
    const client = this.getClient(accountId);
    if (!client) throw new Error("Client not initialized");

    const entity = await entityResolver.resolveEntity(client, groupId);
    const members: any[] = [];
    let offset = 0;
    const limit = 100;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysActive);
    const cutoffTime = Math.floor(cutoffDate.getTime() / 1000);

    while (true) {
      try {
        const result = await client.invoke(new Api.channels.GetParticipants({
          channel: entity,
          filter: new Api.ChannelParticipantsRecent(),
          offset,
          limit,
          hash: BigInt(0) as any
        }));

        if (!result || !(result as any).participants || (result as any).participants.length === 0) break;

        const participants = (result as any).participants;
        const users = (result as any).users; // Detailed user objects are usually here

        // Map users for easier access
        const userMap = new Map();
        if (users) {
          users.forEach((u: any) => userMap.set(u.id.toString(), u));
        }

        for (const p of participants) {
          // Get user details either from p.userId (if it's a participant object) or direct user object
          const userId = p.userId ? p.userId.toString() : p.id.toString();
          const user = userMap.get(userId);

          if (user && user.status) {
            // Check status
            let isEngaged = false;

            if (user.status.className === 'UserStatusOnline') {
              isEngaged = true;
            } else if (user.status.className === 'UserStatusOffline') {
              if (user.status.wasOnline >= cutoffTime) {
                isEngaged = true;
              }
            } else if (user.status.className === 'UserStatusRecently') {
              // "Recently" usually means within 2-3 days
              isEngaged = true;
            }

            if (isEngaged) {
              members.push(user);
            }
          }
        }

        offset += limit;
        if (members.length >= 5000) break; // Hard limit for safety

        // Smart delay to avoid flood wait
        await new Promise(resolve => setTimeout(resolve, 800));

      } catch (error) {
        console.error('Extraction error:', error);
        break;
      }
    }

    return members;
  }

  /**
   * Extract group admins
   */
  async extractGroupAdmins(accountId: number, groupId: string): Promise<any[]> {
    const client = this.getClient(accountId);
    if (!client) throw new Error("Client not initialized");

    const entity = await entityResolver.resolveEntity(client, groupId);
    const admins: any[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      try {
        const result = await client.invoke(new Api.channels.GetParticipants({
          channel: entity,
          filter: new Api.ChannelParticipantsAdmins(),
          offset,
          limit,
          hash: BigInt(0) as any
        }));

        if (!result || !(result as any).participants || (result as any).participants.length === 0) break;

        // For admins filter, participants list typically contains the admin info
        // We need to fetch the actual User objects usually returned in 'users' list
        const users = (result as any).users;

        if (users && users.length > 0) {
          admins.push(...users);
        }

        offset += limit;
        // Admins lists are usually small, so we might not need pagination loop as much, but safely keep it
        if ((result as any).participants.length < limit) break;

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Admin extraction error:', error);
        break;
      }
    }

    return admins;
  }

  /**
   * Send bulk messages (real implementation with flood handling)
   */
  async sendBulkMessages(accountId: number, userIds: number[], message: string, delayMs: number): Promise<{ success: number; failed: number }> {
    const client = this.getClient(accountId);
    if (!client) throw new Error("Client not initialized");

    let success = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        await client.sendMessage(String(userId), { message });
        success++;

        // Respect the delay
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (error: any) {
        console.error(`[TelegramClient] Failed to send message to ${userId}:`, error);

        // Handle Flood Wait
        if (error.seconds) {
          console.warn(`[TelegramClient] Flood wait for ${error.seconds} seconds. Pausing...`);
          await new Promise(resolve => setTimeout(resolve, error.seconds * 1000 + 1000));
          // Retry once after wait
          try {
            await client.sendMessage(String(userId), { message });
            success++;
          } catch (retryError) {
            console.error(`[TelegramClient] Retry failed for ${userId}:`, retryError);
            failed++;
          }
        } else {
          failed++;
        }
      }
    }

    return { success, failed };
  }
}

export const telegramClientService = new TelegramClientService();
