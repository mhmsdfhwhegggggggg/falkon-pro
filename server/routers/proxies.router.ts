import { z } from "zod";
import { licenseProtectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

const ProxyItemSchema = z.object({
  host: z.string(),
  port: z.number().int().positive(),
  type: z.enum(["socks5", "http"]).default("socks5"),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
});

export const proxiesRouter = router({
  /**
   * Import proxies for an account. Accepts either JSON array or CSV text.
   * CSV format: host,port,type,username,password
   */
  importProxies: licenseProtectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        items: z.array(ProxyItemSchema).optional(),
        csvText: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const account = await db.getTelegramAccountById(input.accountId);
      if (!account || account.userId !== ctx.user!.id) {
        throw new Error("Account not found or unauthorized");
      }

      const toInsert: Array<z.infer<typeof ProxyItemSchema>> = [];
      if (input.items && input.items.length > 0) {
        toInsert.push(...input.items);
      }
      if (input.csvText && input.csvText.trim().length > 0) {
        const lines = input.csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          const [host, portStr, type, username, password] = line.split(",");
          if (!host || !portStr) continue;
          const port = parseInt(portStr, 10);
          if (!Number.isFinite(port)) continue;
          toInsert.push({
            host: host.trim(),
            port,
            type: (type?.trim()?.toLowerCase() === "http" ? "http" : "socks5") as "http" | "socks5",
            username: username ? username.trim() : undefined,
            password: password ? password.trim() : undefined,
          });
        }
      }

      if (toInsert.length === 0) {
        return { inserted: 0 } as const;
        }

      let inserted = 0;
      for (const p of toInsert) {
        await db.createProxyConfig({
          accountId: input.accountId,
          host: p.host,
          port: p.port,
          type: p.type,
          username: p.username ?? null,
          password: p.password ?? null,
          active: true,
          health: "unknown",
          lastCheckedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
        inserted++;
      }

      return { inserted } as const;
    }),

  /**
   * List proxies for an account
   */
  listProxies: licenseProtectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input, ctx }) => {
      const account = await db.getTelegramAccountById(input.accountId);
      if (!account || account.userId !== ctx.user!.id) {
        throw new Error("Account not found or unauthorized");
      }
      const proxies = await db.getProxyConfigsByAccountId(input.accountId);
      return { proxies } as const;
    }),
});
