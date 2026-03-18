import { router, publicProcedure, adminProcedure } from '../_core/trpc';
import { z } from 'zod';
import { permissionManager } from '../services/permission-manager';

/**
 * Permission Management Router
 * 
 * لوحة تحكم المطور للتصاريح
 * API endpoints for managing app permissions
 */

export const permissionRouter = router({
  /**
   * Create new permission
   */
  createPermission: adminProcedure
    .input(z.object({
      deviceId: z.string().min(1),
      deviceName: z.string().optional(),
      permissionType: z.enum(['trial', 'basic', 'premium', 'unlimited']).default('trial'),
      durationDays: z.number().min(1).max(3650).optional(),
      maxAccounts: z.number().min(1).optional(),
      maxMessagesPerDay: z.number().min(1).optional(),
      maxOperationsPerDay: z.number().min(1).optional(),
      features: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await permissionManager.createPermission(input);
      return result;
    }),

  /**
   * Validate permission (public - used by app)
   */
  validatePermission: publicProcedure
    .input(z.object({
      permissionKey: z.string().min(1),
      deviceId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const validation = await permissionManager.validatePermission(
        input.permissionKey,
        input.deviceId
      );
      return validation;
    }),

  /**
   * Get all permissions (admin only)
   */
  getAllPermissions: adminProcedure
    .query(async () => {
      const permissions = await permissionManager.getAllPermissions();
      return {
        success: true,
        permissions,
        count: permissions.length,
      };
    }),

  /**
   * Get permission by ID
   */
  getPermission: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const permission = await permissionManager.getPermissionById(input.id);
      return {
        success: !!permission,
        permission,
      };
    }),

  /**
   * Get permission by device ID
   */
  getPermissionByDevice: adminProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ input }) => {
      const permission = await permissionManager.getPermissionByDeviceId(input.deviceId);
      return {
        success: !!permission,
        permission,
      };
    }),

  /**
   * Suspend permission
   */
  suspendPermission: adminProcedure
    .input(z.object({
      permissionId: z.number(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const success = await permissionManager.suspendPermission(input.permissionId, input.reason);
      return {
        success,
        message: success ? 'Permission suspended successfully' : 'Failed to suspend permission',
      };
    }),

  /**
   * Activate suspended permission
   */
  activatePermission: adminProcedure
    .input(z.object({ permissionId: z.number() }))
    .mutation(async ({ input }) => {
      const success = await permissionManager.activatePermission(input.permissionId);
      return {
        success,
        message: success ? 'Permission activated successfully' : 'Failed to activate permission',
      };
    }),

  /**
   * Revoke permission permanently
   */
  revokePermission: adminProcedure
    .input(z.object({ permissionId: z.number() }))
    .mutation(async ({ input }) => {
      const success = await permissionManager.revokePermission(input.permissionId);
      return {
        success,
        message: success ? 'Permission revoked successfully' : 'Failed to revoke permission',
      };
    }),

  /**
   * Extend permission duration
   */
  extendPermission: adminProcedure
    .input(z.object({
      permissionId: z.number(),
      additionalDays: z.number().min(1).max(3650),
    }))
    .mutation(async ({ input }) => {
      const success = await permissionManager.extendPermission(
        input.permissionId,
        input.additionalDays
      );
      return {
        success,
        message: success
          ? `Permission extended by ${input.additionalDays} days`
          : 'Failed to extend permission',
      };
    }),

  /**
   * Update permission limits
   */
  updateLimits: adminProcedure
    .input(z.object({
      permissionId: z.number(),
      maxAccounts: z.number().min(1).optional(),
      maxMessagesPerDay: z.number().min(1).optional(),
      maxOperationsPerDay: z.number().min(1).optional(),
      permissionType: z.enum(['trial', 'basic', 'premium', 'unlimited']).optional(),
    }))
    .mutation(async ({ input }) => {
      const { permissionId, ...limits } = input;
      const success = await permissionManager.updatePermissionLimits(permissionId, limits);
      return {
        success,
        message: success ? 'Limits updated successfully' : 'Failed to update limits',
      };
    }),

  /**
   * Delete permission
   */
  deletePermission: adminProcedure
    .input(z.object({ permissionId: z.number() }))
    .mutation(async ({ input }) => {
      const success = await permissionManager.deletePermission(input.permissionId);
      return {
        success,
        message: success ? 'Permission deleted successfully' : 'Failed to delete permission',
      };
    }),

  /**
   * Get permission statistics
   */
  getStats: adminProcedure
    .query(async () => {
      const stats = await permissionManager.getPermissionStats();
      return {
        success: true,
        stats,
      };
    }),

  /**
   * Bulk operations
   */
  bulkSuspend: adminProcedure
    .input(z.object({
      permissionIds: z.array(z.number()),
      reason: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const results = await Promise.all(
        input.permissionIds.map(id => permissionManager.suspendPermission(id, input.reason))
      );
      const successCount = results.filter(Boolean).length;
      return {
        success: successCount > 0,
        message: `${successCount}/${input.permissionIds.length} permissions suspended`,
        successCount,
        failedCount: input.permissionIds.length - successCount,
      };
    }),

  bulkActivate: adminProcedure
    .input(z.object({
      permissionIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const results = await Promise.all(
        input.permissionIds.map(id => permissionManager.activatePermission(id))
      );
      const successCount = results.filter(Boolean).length;
      return {
        success: successCount > 0,
        message: `${successCount}/${input.permissionIds.length} permissions activated`,
        successCount,
        failedCount: input.permissionIds.length - successCount,
      };
    }),

  bulkRevoke: adminProcedure
    .input(z.object({
      permissionIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const results = await Promise.all(
        input.permissionIds.map(id => permissionManager.revokePermission(id))
      );
      const successCount = results.filter(Boolean).length;
      return {
        success: successCount > 0,
        message: `${successCount}/${input.permissionIds.length} permissions revoked`,
        successCount,
        failedCount: input.permissionIds.length - successCount,
      };
    }),

  /**
   * Generate permission key for new device
   */
  generateKey: adminProcedure
    .query(() => {
      const key = permissionManager.generatePermissionKey();
      return {
        success: true,
        key,
      };
    }),
});
