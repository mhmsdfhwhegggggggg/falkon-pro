import { TelegramClient, Api } from "telegram";

export class EntityResolver {
  async resolveEntity(client: TelegramClient, input: string | number): Promise<any> {
    try {
      // If numeric, use directly
      if (typeof input === "number" || /^\d+$/.test(String(input))) {
        return await (client as any).getEntity(Number(input));
      }
      const text = String(input).trim();
      // Invite links or usernames
      if (text.startsWith("https://t.me/") || text.startsWith("t.me/")) {
        const slug = text.replace(/^https?:\/\/t\.me\//i, "");
        // If it's a joinchat link, attempt import
        if (slug.startsWith("+") || slug.startsWith("joinchat/")) {
          const hash = slug.replace("+", "").replace("joinchat/", "");
          try {
            const result = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
            console.log(`[EntityResolver] Successfully joined group via invite link`);
            return (result as any).chats[0];
          } catch (e: any) {
            if (e.message.includes("USER_ALREADY_PARTICIPANT")) {
              // Get the chat from the invite info instead
              const invite = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
              return (invite as any).chat;
            }
            throw e;
          }
        }
        return await (client as any).getEntity(slug);
      }
      // username form
      if (/^@/.test(text)) {
        return await (client as any).getEntity(text.slice(1));
      }
      // fallback to raw
      return await (client as any).getEntity(text);
    } catch (e) {
      return input;
    }
  }

  async resolveUser(client: TelegramClient, input: string | number): Promise<any> {
    try {
      if (typeof input === "number" || /^\d+$/.test(String(input))) {
        return await (client as any).getEntity(Number(input));
      }
      const text = String(input).trim();
      if (/^@/.test(text)) return await (client as any).getEntity(text.slice(1));
      return await (client as any).getEntity(text);
    } catch {
      return input;
    }
  }
}

export const entityResolver = new EntityResolver();
