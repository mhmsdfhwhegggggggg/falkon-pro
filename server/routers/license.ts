import { router, publicProcedure, protectedProcedure, adminProcedure } from '../_core/trpc';
import { z } from 'zod';
import { licenseManager, LicenseManager } from '../services/license-manager';
import { getDb } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { licenses, subscriptions, licenseUsageLogs } from '../db/schema';

/**
 * License Management Router
 * 
 * tRPC endpoints for license and subscription management
 */

export const licenseRouter = router({
  /**
   * Generate a new license
   */
  generateLicense: adminProcedure
    .input(z.object({
      userId: z.number(),
      type: z.enum(['trial', 'basic', 'premium', 'enterprise']),
      durationDays: z.number().min(1),
      maxAccounts: z.number().min(1),
      maxMessages: z.number().min(1),
      features: z.array(z.string()).default([]),
      autoRenew: z.boolean().default(false),
      renewalPrice: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const license = await (licenseManager as any).generateLicense(input);

        return {
          success: true,
          licenseKey: license.licenseKey,
          message: 'License generated successfully'
        };
      } catch (error) {
        console.error('License generation error:', error);
        return {
          success: false,
          error: 'Failed to generate license',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  /**
   * Validate license key
   */
  validateLicense: publicProcedure
    .input(z.object({
      licenseKey: z.string().min(1),
      hardwareId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const validation = await licenseManager.validateLicense(input.licenseKey, input.hardwareId);

        return {
          success: true,
          validation,
        };
      } catch (error) {
        console.error('License validation error:', error);
        return {
          success: false,
          error: 'Failed to validate license',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  /**
   * Activate license
   */
  activateLicense: publicProcedure
    .input(z.object({
      licenseKey: z.string().min(1),
      hardwareId: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      try {
        const success = await licenseManager.activateLicense(input.licenseKey, input.hardwareId);

        return {
          success,
          message: success ? 'License activated successfully' : 'Failed to activate license'
        };
      } catch (error) {
        console.error('License activation error:', error);
        return {
          success: false,
          error: 'Failed to activate license',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  /**
   * Deactivate license
   */
  deactivateLicense: adminProcedure
    .input(z.object({
      licenseKey: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      try {
        const success = await licenseManager.deactivateLicense(input.licenseKey);

        return {
          success,
          message: success ? 'License deactivated successfully' : 'Failed to deactivate license'
        };
      } catch (error) {
        console.error('License deactivation error:', error);
        return {
          success: false,
          error: 'Failed to deactivate license',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  /**
   * Track license usage
   */
  trackUsage: protectedProcedure
    .input(z.object({
      licenseKey: z.string().min(1),
      action: z.string().min(1),
      metadata: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        await licenseManager.trackUsage(input.licenseKey, input.action, input.metadata);

        return {
          success: true,
          message: 'Usage tracked successfully'
        };
      } catch (error) {
        console.error('Usage tracking error:', error);
        return {
          success: false,
          error: 'Failed to track usage',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  /**
   * Create subscription
   */
  createSubscription: adminProcedure
    .input(z.object({
      licenseId: z.number(),
      plan: z.enum(['monthly', 'quarterly', 'yearly', 'lifetime']),
      price: z.number().min(0),
      currency: z.string().default('USD'),
      autoRenew: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      try {
        const subscriptionId = await (licenseManager as any).createSubscription(input);

        return {
          success: true,
          subscriptionId,
          message: 'Subscription created successfully'
        };
      } catch (error) {
        console.error('Subscription creation error:', error);
        return {
          success: false,
          error: 'Failed to create subscription',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  /**
   * Renew subscription
   */
  renewSubscription: adminProcedure
    .input(z.object({
      subscriptionId: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        const success = await licenseManager.renewSubscription(input.subscriptionId);

        return {
          success,
          message: success ? 'Subscription renewed successfully' : 'Failed to renew subscription'
        };
      } catch (error) {
        console.error('Subscription renewal error:', error);
        return {
          success: false,
          error: 'Failed to renew subscription',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  /**
   * Cancel subscription
   */
  cancelSubscription: adminProcedure
    .input(z.object({
      subscriptionId: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        const success = await licenseManager.cancelSubscription(input.subscriptionId);

        return {
          success,
          message: success ? 'Subscription cancelled successfully' : 'Failed to cancel subscription'
        };
      } catch (error) {
        console.error('Subscription cancellation error:', error);
        return {
          success: false,
          error: 'Failed to cancel subscription',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  /**
   * Get license analytics
   */
  getAnalytics: adminProcedure
    .query(async () => {
      try {
        const analytics = await licenseManager.getLicenseAnalytics();

        return {
          success: true,
          analytics,
        };
      } catch (error) {
        console.error('Analytics error:', error);
        return {
          success: false,
          error: 'Failed to get analytics',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  /**
   * Get user licenses
   */
  getUserLicenses: protectedProcedure
    .input(z.object({
      userId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          return {
            success: false,
            error: 'Database not available'
          };
        }

        const targetUserId = input.userId || ctx.user.id;

        const userLicenses = await db.select()
          .from(licenses)
          .where(eq(licenses.userId, targetUserId))
          .orderBy(desc(licenses.createdAt));

        return {
          success: true,
          licenses: userLicenses,
        };
      } catch (error) {
        console.error('Get user licenses error:', error);
        return {
          success: false,
          error: 'Failed to get user licenses',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  /**
   * Get license details
   */
  getLicenseDetails: protectedProcedure
    .input(z.object({
      licenseId: z.number(),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          return {
            success: false,
            error: 'Database not available'
          };
        }

        const license = await db.select()
          .from(licenses)
          .where(eq(licenses.id, input.licenseId))
          .limit(1);

        if (license.length === 0) {
          return {
            success: false,
            error: 'License not found'
          };
        }

        // Get subscription if exists
        const subscription = await db.select()
          .from(subscriptions)
          .where(eq(subscriptions.licenseId, input.licenseId))
          .limit(1);

        // Get recent usage logs
        const usageLogs = await db.select()
          .from(licenseUsageLogs)
          .where(eq(licenseUsageLogs.licenseId, input.licenseId))
          .orderBy(desc(licenseUsageLogs.timestamp))
          .limit(10);

        return {
          success: true,
          license: license[0],
          subscription: subscription[0] || null,
          usageLogs,
        };
      } catch (error) {
        console.error('Get license details error:', error);
        return {
          success: false,
          error: 'Failed to get license details',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  /**
   * Generate hardware ID
   */
  generateHardwareId: publicProcedure
    .query(() => {
      try {
        const hardwareId = LicenseManager.generateHardwareId();

        return {
          success: true,
          hardwareId,
        };
      } catch (error) {
        console.error('Hardware ID generation error:', error);
        return {
          success: false,
          error: 'Failed to generate hardware ID',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  /**
   * Encrypt data
   */
  encryptData: adminProcedure
    .input(z.object({
      data: z.string().min(1),
    }))
    .mutation(({ input }) => {
      try {
        const encrypted = (licenseManager as any).encryptData ? (licenseManager as any).encryptData(input.data) : input.data;

        return {
          success: true,
          encrypted,
        };
      } catch (error) {
        console.error('Encryption error:', error);
        return {
          success: false,
          error: 'Failed to encrypt data',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  /**
   * Decrypt data
   */
  decryptData: adminProcedure
    .input(z.object({
      encryptedData: z.string().min(1),
    }))
    .mutation(({ input }) => {
      try {
        const decrypted = (licenseManager as any).decryptData ? (licenseManager as any).decryptData(input.encryptedData) : input.encryptedData;

        return {
          success: true,
          decrypted,
        };
      } catch (error) {
        console.error('Decryption error:', error);
        return {
          success: false,
          error: 'Failed to decrypt data',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),
});
