import { z } from "zod";
import { router, licenseProtectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { telegramClientService } from "../services/telegram-client.service";

/**
 * Extraction Router
 * Handles member extraction from Telegram groups
 */
export const extractionRouter = router({
  /**
   * Extract all members from a group
   */
  extractAllMembers: licenseProtectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        groupId: z.string(),
        groupName: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const account = await db.getTelegramAccountById(input.accountId);

        if (!account || account.userId !== ctx.user!.id) {
          throw new Error("Account not found or unauthorized");
        }

        // Initialize client
        const credentials = telegramClientService.getApiCredentials();
        const client = await telegramClientService.initializeClient(
          input.accountId,
          account.phoneNumber,
          account.sessionString,
          credentials.apiId,
          credentials.apiHash
        );

        // Extract members
        const members = await telegramClientService.extractGroupMembers(
          input.accountId,
          input.groupId
        );

        // Save to database
        const extractedMembers = members.map((member: any) => ({
          userId: ctx.user!.id,
          telegramAccountId: input.accountId,
          sourceGroupId: input.groupId,
          memberTelegramId: String(member.id || member.userId),
          memberUsername: member.username,
          memberFirstName: member.firstName,
          memberLastName: member.lastName,
          addedDate: new Date(),
        }));

        await db.createExtractedMembers(extractedMembers);

        // Log activity
        await db.createActivityLog({
          userId: ctx.user!.id,
          action: "members_extracted",
          details: JSON.stringify({
            groupId: input.groupId,
            count: members.length,
            type: "all",
          }),
          status: "success",
        });

        // Disconnect client
        await telegramClientService.disconnectClient(input.accountId);

        return {
          success: true,
          membersCount: members.length,
          members: extractedMembers,
        };
      } catch (error) {
        console.error("Failed to extract members:", error);
        await db.createActivityLog({
          userId: ctx.user!.id,
          action: "members_extracted",
          details: JSON.stringify({ groupId: input.groupId }),
          status: "failed",
        });
        throw new Error(
          `Failed to extract members: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Extract engaged members
   */
  extractEngagedMembers: licenseProtectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        groupId: z.string(),
        daysActive: z.number().default(7),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const account = await db.getTelegramAccountById(input.accountId);

        if (!account || account.userId !== ctx.user!.id) {
          throw new Error("Account not found or unauthorized");
        }

        const credentials = telegramClientService.getApiCredentials();
        await telegramClientService.initializeClient(
          input.accountId,
          account.phoneNumber,
          account.sessionString,
          credentials.apiId,
          credentials.apiHash
        );

        const members = await telegramClientService.extractEngagedMembers(
          input.accountId,
          input.groupId,
          input.daysActive
        );

        const extractedMembers = members.map((member: any) => ({
          userId: ctx.user!.id,
          telegramAccountId: input.accountId,
          sourceGroupId: input.groupId,
          memberTelegramId: String(member.id || member.userId),
          memberUsername: member.username,
          memberFirstName: member.firstName,
          memberLastName: member.lastName,
          addedDate: new Date(),
        }));

        await db.createExtractedMembers(extractedMembers);

        await db.createActivityLog({
          userId: ctx.user!.id,
          action: "engaged_members_extracted",
          details: JSON.stringify({
            groupId: input.groupId,
            count: members.length,
            daysActive: input.daysActive,
          }),
          status: "success",
        });

        await telegramClientService.disconnectClient(input.accountId);

        return {
          success: true,
          membersCount: members.length,
          members: extractedMembers,
        };
      } catch (error) {
        console.error("Failed to extract engaged members:", error);
        throw new Error(
          `Failed to extract engaged members: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Extract group administrators
   */
  extractAdmins: licenseProtectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        groupId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const account = await db.getTelegramAccountById(input.accountId);

        if (!account || account.userId !== ctx.user!.id) {
          throw new Error("Account not found or unauthorized");
        }

        const credentials = telegramClientService.getApiCredentials();
        await telegramClientService.initializeClient(
          input.accountId,
          account.phoneNumber,
          account.sessionString,
          credentials.apiId,
          credentials.apiHash
        );

        const admins = await telegramClientService.extractGroupAdmins(
          input.accountId,
          input.groupId
        );

        const extractedAdmins = admins.map((admin: any) => ({
          userId: ctx.user!.id,
          telegramAccountId: input.accountId,
          sourceGroupId: input.groupId,
          memberTelegramId: String(admin.id || admin.userId),
          memberUsername: admin.username,
          memberFirstName: admin.firstName,
          memberLastName: admin.lastName,
          addedDate: new Date(),
        }));

        await db.createExtractedMembers(extractedAdmins);

        await db.createActivityLog({
          userId: ctx.user!.id,
          action: "admins_extracted",
          details: JSON.stringify({
            groupId: input.groupId,
            count: admins.length,
          }),
          status: "success",
        });

        await telegramClientService.disconnectClient(input.accountId);

        return {
          success: true,
          adminsCount: admins.length,
          admins: extractedAdmins,
        };
      } catch (error) {
        console.error("Failed to extract admins:", error);
        throw new Error(
          `Failed to extract admins: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Get extracted members
   */
  getExtractedMembers: licenseProtectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        groupId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const account = await db.getTelegramAccountById(input.accountId);

        if (!account || account.userId !== ctx.user!.id) {
          throw new Error("Account not found or unauthorized");
        }

        const members = await db.getExtractedMembersByAccountAndGroup(
          ctx.user!.id,
          input.groupId
        );

        return {
          success: true,
          count: members.length,
          members,
        };
      } catch (error) {
        console.error("Failed to get extracted members:", error);
        throw new Error("Failed to get extracted members");
      }
    }),
});

