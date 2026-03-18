import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { Secrets } from "../_core/secrets";

export const setupRouter = router({
  getStatus: publicProcedure.query(() => {
    const all = Secrets.getAll();
    const hasTelegram = !!all.TELEGRAM_API_ID && !!all.TELEGRAM_API_HASH;
    const hasEnc = !!all.SESSION_ENC_KEY; // will be auto-generated on demand
    const hasDb = !!Secrets.getDatabaseUrl();
    const hasRedis = !!Secrets.getRedisUrl();
    return { hasTelegram, hasEnc, hasDb, hasRedis } as const;
  }),

  setTelegram: protectedProcedure
    .input(z.object({ apiId: z.number().min(1), apiHash: z.string().min(10) }))
    .mutation(({ input }) => {
      Secrets.setTelegramCredentials(input.apiId, input.apiHash);
      return { saved: true } as const;
    }),

  setDatabase: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(({ input }) => {
      Secrets.setDatabaseUrl(input.url);
      return { saved: true } as const;
    }),

  setRedis: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(({ input }) => {
      Secrets.setRedisUrl(input.url);
      return { saved: true } as const;
    }),
});
