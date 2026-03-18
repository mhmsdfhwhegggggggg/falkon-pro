/**
 * Permission Manager - Advanced permission management
 * Handles user permissions, licensing levels, and access control
 */

export interface Permission {
  id: number;
  deviceId?: string;
  deviceName?: string;
  permissionType: 'trial' | 'basic' | 'premium' | 'unlimited';
  permissionKey: string;
  status: 'active' | 'suspended' | 'expired' | 'revoked';
  maxAccounts: number;
  maxMessagesPerDay: number;
  maxOperationsPerDay: number;
  features: string[];
  expiresAt?: Date;
  suspendedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PermissionManager {
  private static instance: PermissionManager;
  private permissions: Map<number, Permission> = new Map();
  private nextId: number = 1;

  private constructor() { }

  static getInstance(): PermissionManager {
    if (!this.instance) {
      this.instance = new PermissionManager();
    }
    return this.instance;
  }

  async createPermission(input: any): Promise<Permission> {
    const perm: Permission = {
      id: this.nextId++,
      deviceId: input.deviceId,
      deviceName: input.deviceName,
      permissionType: input.permissionType || 'trial',
      permissionKey: this.generatePermissionKey(),
      status: 'active',
      maxAccounts: input.maxAccounts || 5,
      maxMessagesPerDay: input.maxMessagesPerDay || 100,
      maxOperationsPerDay: input.maxOperationsPerDay || 50,
      features: input.features || [],
      expiresAt: input.durationDays ? new Date(Date.now() + input.durationDays * 86400000) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.permissions.set(perm.id, perm);
    return perm;
  }

  async validatePermission(key: string, deviceId?: string): Promise<{ valid: boolean; reason?: string; permission?: Permission }> {
    const perm = Array.from(this.permissions.values()).find(p => p.permissionKey === key);
    if (!perm) return { valid: false, reason: 'Invalid key' };
    if (perm.status !== 'active') return { valid: false, reason: `Permission ${perm.status}` };
    if (perm.expiresAt && perm.expiresAt < new Date()) {
      perm.status = 'expired';
      return { valid: false, reason: 'Permission expired' };
    }
    if (deviceId && perm.deviceId && perm.deviceId !== deviceId) {
      return { valid: false, reason: 'Device mismatch' };
    }
    return { valid: true, permission: perm };
  }

  async getAllPermissions(): Promise<Permission[]> {
    return Array.from(this.permissions.values());
  }

  async getPermissionById(id: number): Promise<Permission | null> {
    return this.permissions.get(id) || null;
  }

  async getPermissionByDeviceId(deviceId: string): Promise<Permission | null> {
    return Array.from(this.permissions.values()).find(p => p.deviceId === deviceId) || null;
  }

  async suspendPermission(id: number, reason: string): Promise<boolean> {
    const perm = this.permissions.get(id);
    if (!perm) return false;
    perm.status = 'suspended';
    perm.suspendedReason = reason;
    perm.updatedAt = new Date();
    return true;
  }

  async activatePermission(id: number): Promise<boolean> {
    const perm = this.permissions.get(id);
    if (!perm) return false;
    perm.status = 'active';
    perm.suspendedReason = undefined;
    perm.updatedAt = new Date();
    return true;
  }

  async revokePermission(id: number): Promise<boolean> {
    const perm = this.permissions.get(id);
    if (!perm) return false;
    perm.status = 'revoked';
    perm.updatedAt = new Date();
    return true;
  }

  async extendPermission(id: number, additionalDays: number): Promise<boolean> {
    const perm = this.permissions.get(id);
    if (!perm) return false;
    const currentExpiry = perm.expiresAt ? perm.expiresAt.getTime() : Date.now();
    perm.expiresAt = new Date(currentExpiry + additionalDays * 86400000);
    perm.updatedAt = new Date();
    return true;
  }

  async updatePermissionLimits(id: number, limits: any): Promise<boolean> {
    const perm = this.permissions.get(id);
    if (!perm) return false;
    if (limits.maxAccounts) perm.maxAccounts = limits.maxAccounts;
    if (limits.maxMessagesPerDay) perm.maxMessagesPerDay = limits.maxMessagesPerDay;
    if (limits.maxOperationsPerDay) perm.maxOperationsPerDay = limits.maxOperationsPerDay;
    if (limits.permissionType) perm.permissionType = limits.permissionType;
    perm.updatedAt = new Date();
    return true;
  }

  async deletePermission(id: number): Promise<boolean> {
    return this.permissions.delete(id);
  }

  async getPermissionStats(): Promise<any> {
    const all = Array.from(this.permissions.values());
    return {
      total: all.length,
      active: all.filter(p => p.status === 'active').length,
      suspended: all.filter(p => p.status === 'suspended').length,
      expired: all.filter(p => p.status === 'expired').length,
      trial: all.filter(p => p.permissionType === 'trial').length,
      basic: all.filter(p => p.permissionType === 'basic').length,
      premium: all.filter(p => p.permissionType === 'premium').length,
      unlimited: all.filter(p => p.permissionType === 'unlimited').length,
    };
  }

  generatePermissionKey(): string {
    return 'FALCON-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' +
      Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  // legacy compatibility
  hasPermission(userId: number, permissionId: string): boolean {
    return true; // Simplified for now
  }
}

export const permissionManager = PermissionManager.getInstance();
