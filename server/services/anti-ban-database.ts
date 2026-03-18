import * as db from "../db";

/**
 * Anti-Ban Database Integration
 * 
 * Handles all database operations for the Anti-Ban system
 * Provides persistent storage for:
 * - Account health metrics
 * - Operation history
 * - Risk assessment data
 * - Performance statistics
 * - Proxy performance data
 */

export class AntiBanDatabase {
  private static instance: AntiBanDatabase;

  private constructor() { }

  static getInstance(): AntiBanDatabase {
    if (!AntiBanDatabase.instance) {
      AntiBanDatabase.instance = new AntiBanDatabase();
    }
    return AntiBanDatabase.instance;
  }

  /**
   * Initialize Anti-Ban data for a new account
   */
  async initializeAccount(accountId: number): Promise<void> {
    try {
      // Check if already initialized
      const existingRules = await db.getAntiBanRules(accountId);
      if (!existingRules) {
        // Create default anti-ban rules
        await db.createAntiBanRules({
          accountId,
          minDelayMs: 1000,
          maxDelayMs: 3000,
          dailyMessageLimit: 100,
          dailyJoinLimit: 20,
          dailyAddUserLimit: 50,
          useProxyRotation: true,
          enableRandomization: true,
        });
      }

      // Initialize rate limiting tracking
      await this.initializeRateLimiting(accountId);

      console.log(`✅ Anti-Ban: Initialized account ${accountId}`);
    } catch (error) {
      console.error(`❌ Failed to initialize account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Record operation result in database
   */
  async recordOperation(
    accountId: number,
    operation: {
      type: string;
      targetCount: number;
      speed: string;
    },
    result: {
      success: boolean;
      duration: number;
      actualDelay: number;
      responseTime: number;
      proxyUsed?: number;
      errorType?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    try {
      // 1. Record in operation results table
      await db.createOperationResult({
        accountId,
        operationType: operation.type,
        targetCount: operation.targetCount,
        success: result.success,
        duration: result.duration,
        actualDelay: result.actualDelay,
        responseTime: result.responseTime,
        proxyUsed: result.proxyUsed,
        errorType: result.errorType,
        errorMessage: result.errorMessage,
        timestamp: new Date(),
      });

      // 2. Update rate limiting
      await this.updateRateLimiting(accountId, operation.type, result.success);

      // 3. Update account health metrics
      await this.updateAccountHealth(accountId, result);

      // 4. Update proxy performance if proxy was used
      if (result.proxyUsed) {
        await this.updateProxyPerformance(result.proxyUsed, result);
      }

      console.log(`📊 Anti-Ban: Recorded operation for account ${accountId}`);
    } catch (error) {
      console.error(`❌ Failed to record operation:`, error);
      throw error;
    }
  }

  /**
   * Get account health metrics
   */
  async getAccountHealth(accountId: number): Promise<any> {
    try {
      // Get recent operations (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentOperations = await db.getOperationResults(accountId, oneDayAgo);

      // Calculate metrics
      const totalOperations = recentOperations.length;
      const successfulOperations = recentOperations.filter(op => op.success).length;
      const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0;

      // Get consecutive failures
      const consecutiveFailures = await this.getConsecutiveFailures(accountId);

      // Get average response time
      const avgResponseTime = totalOperations > 0
        ? recentOperations.reduce((sum, op) => sum + (op.responseTime || 0), 0) / totalOperations
        : 0;

      // Get risk score
      const riskScore = await this.calculateRiskScore(accountId, recentOperations);

      return {
        accountId,
        totalOperations,
        successfulOperations,
        successRate,
        consecutiveFailures,
        avgResponseTime,
        riskScore,
        lastUpdated: new Date(),
        healthLevel: this.getHealthLevel(successRate, riskScore, consecutiveFailures),
      };
    } catch (error) {
      console.error(`❌ Failed to get account health:`, error);
      throw error;
    }
  }

  /**
   * Get system-wide statistics
   */
  async getSystemStatistics(): Promise<any> {
    try {
      // Get all accounts
      const accounts = await db.getAllTelegramAccounts();
      const totalAccounts = accounts.length;

      let healthyAccounts = 0;
      let totalOperations = 0;
      let totalSuccesses = 0;
      let totalRiskScore = 0;

      for (const account of accounts) {
        const health = await this.getAccountHealth(account.id);
        if (health.healthLevel === 'excellent' || health.healthLevel === 'good') {
          healthyAccounts++;
        }
        totalOperations += health.totalOperations;
        totalSuccesses += health.successfulOperations;
        totalRiskScore += health.riskScore;
      }

      const averageSuccessRate = totalAccounts > 0 ? (totalSuccesses / totalOperations) * 100 : 0;
      const averageRiskScore = totalAccounts > 0 ? totalRiskScore / totalAccounts : 0;

      // Get proxy statistics
      const proxyStats = await this.getProxyStatistics();

      return {
        totalAccounts,
        healthyAccounts,
        averageSuccessRate,
        averageRiskScore,
        totalOperations,
        proxyStatistics: proxyStats,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error(`❌ Failed to get system statistics:`, error);
      throw error;
    }
  }

  /**
   * Update rate limiting for an account
   */
  private async updateRateLimiting(accountId: number, operationType: string, success: boolean): Promise<void> {
    try {
      // Get current rate limit tracking
      const rateLimit = await db.getRateLimitTracking(accountId, operationType);

      if (!rateLimit) {
        // Create new tracking entry
        await db.createRateLimitTracking({
          accountId,
          actionType: operationType,
          count: success ? 1 : 0,
          resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Reset in 24 hours
        });
      } else {
        // Update existing tracking
        if (success) {
          await db.updateRateLimitTracking(rateLimit.id, {
            count: rateLimit.count + 1,
          });
        }
      }
    } catch (error) {
      console.error(`❌ Failed to update rate limiting:`, error);
    }
  }

  /**
   * Initialize rate limiting for an account
   */
  private async initializeRateLimiting(accountId: number): Promise<void> {
    try {
      const operationTypes = ['message', 'join_group', 'add_user', 'leave_group', 'extract_members'];

      for (const operationType of operationTypes) {
        await db.createRateLimitTracking({
          accountId,
          actionType: operationType,
          count: 0,
          resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      }
    } catch (error) {
      console.error(`❌ Failed to initialize rate limiting:`, error);
    }
  }

  /**
   * Update account health metrics
   */
  private async updateAccountHealth(accountId: number, result: any): Promise<void> {
    try {
      const account = await db.getTelegramAccount(accountId);
      if (!account) return;

      // Update warming level based on success rate
      let warmingLevel = account.warmingLevel || 0;
      if (result.success) {
        warmingLevel = Math.min(100, warmingLevel + 1);
      } else {
        warmingLevel = Math.max(0, warmingLevel - 2);
      }

      // Update messages sent today
      let messagesSentToday = account.messagesSentToday || 0;
      if (result.success && (result as any).operationType === 'message') {
        messagesSentToday++;
      }

      // Check if we need to reset daily counters
      const lastActivity = account.lastActivityAt;
      const today = new Date();
      const needsReset = !lastActivity ||
        lastActivity.toDateString() !== today.toDateString();

      if (needsReset) {
        messagesSentToday = 1; // Reset and count current operation
      }

      // Update account
      await db.updateTelegramAccount(accountId, {
        warmingLevel,
        messagesSentToday,
        lastActivityAt: new Date(),
        isRestricted: !result.success && (result.errorType === 'ACCOUNT_RESTRICTED'),
        restrictionReason: !result.success ? result.errorMessage : null,
      });

    } catch (error) {
      console.error(`❌ Failed to update account health:`, error);
    }
  }

  /**
   * Update proxy performance
   */
  private async updateProxyPerformance(proxyId: number, result: any): Promise<void> {
    try {
      const proxy = await db.getProxyConfig(proxyId);
      if (!proxy) return;

      // Update proxy health based on operation result
      let health = 'unknown';
      if (result.success) {
        health = 'healthy';
      } else if (result.errorType === 'PROXY_ERROR') {
        health = 'unhealthy';
      }

      // Update last used timestamp
      await db.updateProxyConfig(proxyId, {
        health,
        lastUsedAt: new Date(),
      });

    } catch (error) {
      console.error(`❌ Failed to update proxy performance:`, error);
    }
  }

  /**
   * Get consecutive failures for an account
   */
  private async getConsecutiveFailures(accountId: number): Promise<number> {
    try {
      const recentOperations = await db.getOperationResults(
        accountId,
        new Date(Date.now() - 60 * 60 * 1000) // Last hour
      );

      let consecutiveFailures = 0;
      for (let i = recentOperations.length - 1; i >= 0; i--) {
        if (recentOperations[i].success) {
          break;
        }
        consecutiveFailures++;
      }

      return consecutiveFailures;
    } catch (error) {
      console.error(`❌ Failed to get consecutive failures:`, error);
      return 0;
    }
  }

  /**
   * Calculate risk score for an account
   */
  private async calculateRiskScore(accountId: number, operations: any[]): Promise<number> {
    try {
      let riskScore = 0;

      // Factor 1: Success rate (40% weight)
      const successRate = operations.length > 0
        ? operations.filter(op => op.success).length / operations.length
        : 1;
      riskScore += (1 - successRate) * 40;

      // Factor 2: Error frequency (30% weight)
      const errorCount = operations.filter(op => !op.success).length;
      const errorRate = operations.length > 0 ? errorCount / operations.length : 0;
      riskScore += errorRate * 30;

      // Factor 3: Response time (20% weight)
      const avgResponseTime = operations.length > 0
        ? operations.reduce((sum, op) => sum + (op.responseTime || 0), 0) / operations.length
        : 0;
      const responseTimeRisk = Math.min(20, avgResponseTime / 100); // Max 20 points
      riskScore += responseTimeRisk;

      // Factor 4: Account age (10% weight)
      const account = await db.getTelegramAccount(accountId);
      const accountAge = account?.createdAt
        ? (Date.now() - account.createdAt.getTime()) / (1000 * 60 * 60 * 24) // Days
        : 0;
      const ageRisk = Math.max(0, 10 - accountAge); // Newer accounts are riskier
      riskScore += ageRisk;

      return Math.min(100, Math.max(0, riskScore));
    } catch (error) {
      console.error(`❌ Failed to calculate risk score:`, error);
      return 50; // Default medium risk
    }
  }

  /**
   * Get health level based on metrics
   */
  private getHealthLevel(successRate: number, riskScore: number, consecutiveFailures: number): string {
    if (successRate >= 95 && riskScore < 20 && consecutiveFailures < 2) {
      return 'excellent';
    } else if (successRate >= 85 && riskScore < 40 && consecutiveFailures < 5) {
      return 'good';
    } else if (successRate >= 70 && riskScore < 60 && consecutiveFailures < 10) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  /**
   * Get proxy statistics
   */
  private async getProxyStatistics(): Promise<any> {
    try {
      const proxies = await db.getAllProxyConfigs();
      const totalProxies = proxies.length;
      const healthyProxies = proxies.filter(p => p.health === 'healthy').length;
      const unhealthyProxies = proxies.filter(p => p.health === 'unhealthy').length;

      // Calculate average response time from recent operations
      const recentOperations = await db.getRecentOperationResults(100); // Last 100 operations
      const averageResponseTime = recentOperations.length > 0
        ? recentOperations.reduce((sum, op) => sum + (op.responseTime || 0), 0) / recentOperations.length
        : 0;

      return {
        totalProxies,
        healthyProxies,
        unhealthyProxies,
        unknownProxies: totalProxies - healthyProxies - unhealthyProxies,
        healthPercentage: totalProxies > 0 ? (healthyProxies / totalProxies) * 100 : 0,
        averageResponseTime,
      };
    } catch (error) {
      console.error(`❌ Failed to get proxy statistics:`, error);
      return {
        totalProxies: 0,
        healthyProxies: 0,
        unhealthyProxies: 0,
        unknownProxies: 0,
        healthPercentage: 0,
        averageResponseTime: 0,
      };
    }
  }

  /**
   * Clean up old data (maintenance)
   */
  async cleanupOldData(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

      // Clean old operation results
      await db.deleteOldOperationResults(cutoffDate);

      // Clean old rate limiting entries
      await db.deleteOldRateLimitTracking(cutoffDate);

      console.log(`🧹 Anti-Ban: Cleaned up data older than ${daysToKeep} days`);
    } catch (error) {
      console.error(`❌ Failed to cleanup old data:`, error);
    }
  }
}

export const antiBanDatabase = AntiBanDatabase.getInstance();
