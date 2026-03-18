/**
 * Anti-Ban Core - Basic anti-ban protection system
 * Provides fundamental protection against account bans
 */

export interface OperationRequest {
  type: string;
  targetCount: number;
  speed: 'slow' | 'medium' | 'fast';
  targetInfo?: any;
}

export interface OperationDecision {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  recommendations?: string[];
}

export interface OperationResult {
  success: boolean;
  errorType?: string;
  duration?: number;
  accountId?: number;
}

export class AntiBanCore {
  private static instance: AntiBanCore;
  private operationHistory: Map<number, OperationResult[]> = new Map();
  private rateLimits: Map<string, number> = new Map();

  private constructor() {
    this.initializeRateLimits();
  }

  static getInstance(): AntiBanCore {
    if (!this.instance) {
      this.instance = new AntiBanCore();
    }
    return this.instance;
  }

  private initializeRateLimits() {
    // Basic rate limits per operation type
    this.rateLimits.set('message', 100); // 100 messages per hour
    this.rateLimits.set('extract', 10);  // 10 extractions per hour
    this.rateLimits.set('add_user', 50);  // 50 user additions per hour
    this.rateLimits.set('join_group', 20); // 20 group joins per hour
  }

  /**
   * Pre-operation check
   */
  async preOperationCheck(
    accountId: number,
    operationType: string,
    targetInfo?: any
  ): Promise<OperationDecision> {
    const history = this.operationHistory.get(accountId) || [];
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    // Count recent operations
    const recentOps = history.filter(op =>
      op.duration && op.duration > oneHourAgo &&
      op.accountId === accountId
    );

    const rateLimit = this.rateLimits.get(operationType) || 10;

    if (recentOps.length >= rateLimit) {
      return {
        allowed: false,
        reason: `Rate limit exceeded. Max ${rateLimit} ${operationType} operations per hour.`,
        retryAfter: 60 * 60 * 1000, // 1 hour
        recommendations: ['WAIT_AND_RETRY']
      };
    }

    // Check for recent failures
    const recentFailures = history.filter(op =>
      !op.success &&
      op.duration && op.duration > oneHourAgo
    );

    if (recentFailures.length >= 3) {
      return {
        allowed: false,
        reason: 'Too many recent failures. Account may be restricted.',
        retryAfter: 30 * 60 * 1000, // 30 minutes
        recommendations: ['WAIT_AND_RETRY', 'CHECK_ACCOUNT_STATUS']
      };
    }

    return { allowed: true };
  }

  /**
   * Record operation result
   */
  recordOperationResult(
    accountId: number,
    operationType: string,
    success: boolean,
    errorType?: string
  ): void {
    const history = this.operationHistory.get(accountId) || [];

    const result: OperationResult = {
      success,
      errorType,
      duration: Date.now(),
      accountId
    };

    history.push(result);

    // Keep only last 100 operations per account
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    this.operationHistory.set(accountId, history);
  }

  /**
   * Get operation statistics
   */
  getOperationStats(accountId: number): {
    total: number;
    success: number;
    failure: number;
    successRate: number;
  } {
    const history = this.operationHistory.get(accountId) || [];

    const success = history.filter(op => op.success).length;
    const failure = history.filter(op => !op.success).length;
    const total = history.length;
    const successRate = total > 0 ? (success / total) * 100 : 0;

    return { total, success, failure, successRate };
  }

  /**
   * Check if account is at risk
   */
  isAccountAtRisk(accountId: number): boolean {
    const stats = this.getOperationStats(accountId);

    // Risk factors
    const lowSuccessRate = stats.successRate < 70;
    const highFailureRate = stats.failure > 10;
    const manyOperations = stats.total > 50;

    return lowSuccessRate || highFailureRate || manyOperations;
  }

  /**
   * Get recommended delay for next operation
   */
  getRecommendedDelay(accountId: number, operationType: string): number {
    const history = this.operationHistory.get(accountId) || [];
    const now = Date.now();

    // Find last operation of same type
    const lastOp = history
      .filter(op => op.accountId === accountId)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
    [0];

    if (!lastOp) {
      return 1000; // 1 second default
    }

    const timeSinceLastOp = now - (lastOp.duration || 0);
    const baseDelay = this.getBaseDelay(operationType);

    // Increase delay if last operation failed
    if (!lastOp.success) {
      return Math.max(baseDelay * 3, 5000); // At least 5 seconds
    }

    // Minimum delay between operations
    return Math.max(baseDelay - timeSinceLastOp, 500);
  }

  private getBaseDelay(operationType: string): number {
    switch (operationType) {
      case 'message': return 2000;      // 2 seconds
      case 'extract': return 5000;      // 5 seconds
      case 'add_user': return 3000;     // 3 seconds
      case 'join_group': return 4000;  // 4 seconds
      default: return 2000;
    }
  }
  /**
   * Get overall account status
   */
  getAccountStatus(accountId: number): {
    isHealthy: boolean;
    canOperate: boolean;
    restrictions: string[];
  } {
    const stats = this.getOperationStats(accountId);
    const isAtRisk = this.isAccountAtRisk(accountId);
    const restrictions = [];

    if (isAtRisk) restrictions.push('AT_RISK');

    return {
      isHealthy: !isAtRisk,
      canOperate: !isAtRisk, // Simplified logic
      restrictions
    };
  }
}

export const antiBanCore = AntiBanCore.getInstance();
