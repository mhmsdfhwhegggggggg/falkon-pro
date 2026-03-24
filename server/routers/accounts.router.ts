import { router, licenseProtectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { JobQueue } from "../_core/queue";
import * as dbHelper from "../db";
import { ApiCredentialsGenerator } from "../services/api-credentials-generator";
import { telegramClientService } from "../services/telegram-client.service";

export const accountsRouter = router({
  // Get all accounts for the current user
  getAll: licenseProtectedProcedure.query(async ({ ctx }) => {
    const accounts = await dbHelper.getTelegramAccountsByUserId(ctx.user!.id);

    return accounts.map((account) => ({
      id: account.id,
      phoneNumber: account.phoneNumber,
      username: account.username || "",
      firstName: account.firstName || "",
      lastName: account.lastName || "",
      isActive: account.isActive,
      messagesSentToday: account.messagesSentToday,
      dailyLimit: account.dailyLimit,
      warmingLevel: account.warmingLevel,
      isRestricted: account.isRestricted,
      restrictionReason: account.restrictionReason || "",
      lastActivity: account.lastActivityAt?.toISOString() || new Date().toISOString(),
    }));
  }),

  // Add a new Telegram account
  add: licenseProtectedProcedure
    .input(
      z.object({
        phoneNumber: z.string(),
        sessionString: z.string(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        username: z.string().optional(),
        telegramId: z.string().optional(),
        apiId: z.number().optional(),
        apiHash: z.string().optional(),
        credentialSource: z.string().default('shared'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newAccount = await dbHelper.createTelegramAccount({
        userId: ctx.user!.id,
        phoneNumber: input.phoneNumber,
        sessionString: input.sessionString,
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username,
        telegramId: input.telegramId,
        isActive: true,
        warmingLevel: 0,
        messagesSentToday: 0,
        dailyLimit: 100,
        apiId: input.apiId,
        apiHash: input.apiHash,
        credentialSource: input.credentialSource as any,
      } as any);

      return { success: true, account: newAccount };
    }),

  // Step 1: Initialize account addition
  initAddAccount: licenseProtectedProcedure
    .input(z.object({ phoneNumber: z.string() }))
    .mutation(async ({ input }) => {
      const credentials = telegramClientService.getApiCredentials();
      const codeRes = await telegramClientService.sendCode(
        input.phoneNumber,
        credentials.apiId,
        credentials.apiHash
      );
      
      // We don't wait for my.telegram.org password send here to avoid blocking, 
      // but it's handled in the generator if needed. 
      // Actually my.telegram.org requires a random_hash from the send_password call.
      
      return { 
        success: true, 
        phoneCodeHash: codeRes.phoneCodeHash,
        isCodeSent: true 
      };
    }),

  // Step 2: Confirm and finalize
  confirmAddAccount: licenseProtectedProcedure
    .input(z.object({
      phoneNumber: z.string(),
      phoneCodeHash: z.string(),
      code: z.string(),
      password: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. Log in to Telegram
      const credentials = telegramClientService.getApiCredentials();
      const loginRes = await telegramClientService.signIn(
        input.phoneNumber,
        input.phoneCodeHash,
        input.code,
        credentials.apiId,
        credentials.apiHash,
        input.password
      );

      // 2. Attempt to generate custom API credentials (Multi-layer)
      const apiResult = await ApiCredentialsGenerator.generateCredentialsGuaranteed(
        input.phoneNumber,
        input.code,
        ctx.user!.id
      );

      // 3. Create account
      const me = loginRes.user;
      
      const newAccount = await dbHelper.createTelegramAccount({
        userId: ctx.user!.id,
        phoneNumber: input.phoneNumber,
        sessionString: loginRes.sessionString,
        firstName: me?.firstName || "",
        lastName: me?.lastName || "",
        username: me?.username || "",
        telegramId: me ? String(me.id) : "unknown",
        isActive: true,
        apiId: apiResult.apiId,
        apiHash: apiResult.apiHash,
        credentialSource: apiResult.source as any,
      } as any);

      return { 
        success: true, 
        account: newAccount,
        apiSource: apiResult.source 
      };
    }),

  // Delete an account
  delete: licenseProtectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await dbHelper.deleteTelegramAccount(input.id);
      return { success: true };
    }),

  // Update account status
  updateStatus: licenseProtectedProcedure
    .input(
      z.object({
        id: z.number(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await dbHelper.updateTelegramAccount(input.id, { isActive: input.isActive } as any);
      return { success: true };
    }),

  // Enqueue: send login codes to many phone numbers (bulk onboarding)
  bulkSendLoginCodes: licenseProtectedProcedure
    .input(z.object({ phoneNumbers: z.array(z.string().min(5)).min(1) }))
    .mutation(async ({ input }) => {
      const job = await JobQueue.enqueue("send-login-codes", { phoneNumbers: input.phoneNumbers } as any);
      return { queued: true, jobId: job.id } as const;
    }),

  // Enqueue: confirm login codes (and optional 2FA) and create accounts
  bulkConfirmCodes: licenseProtectedProcedure
    .input(z.object({ items: z.array(z.object({ phoneNumber: z.string().min(5), code: z.string().min(2), password: z.string().optional() })).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const job = await JobQueue.enqueue("confirm-login-codes", { userId: ctx.user!.id, items: input.items } as any);
      return { queued: true, jobId: job.id } as const;
    }),
  // Get health overview (global)
  getHealthOverview: licenseProtectedProcedure.query(async ({ ctx }) => {
    const accounts = await dbHelper.getTelegramAccountsByUserId(ctx.user!.id);
    const healthyCount = accounts.filter(a => !a.isRestricted && a.isActive).length;
    const restrictedCount = accounts.filter(a => a.isRestricted).length;
    const inactiveCount = accounts.filter(a => !a.isActive).length;

    return {
      totalCount: accounts.length,
      healthyCount,
      restrictedCount,
      inactiveCount,
      privateApiCount: accounts.filter(a => a.credentialSource !== 'shared').length,
    };
  }),
});

