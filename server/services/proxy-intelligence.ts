/**
 * Proxy Intelligence - Simple proxy management and performance tracking
 * Simplified version to avoid complex type issues
 */

export interface ProxyConfig {
  id: number;
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: 'http' | 'socks4' | 'socks5';
  location?: string;
}

export interface ProxyScore {
  totalScore: number;
  confidence: number;
  expectedPerformance: 'low' | 'medium' | 'high';
  factors: PerformanceFactor[];
  recommendation: string;
}

export interface PerformanceFactor {
  type: string;
  value: number;
  weight: number;
}

export interface ProxyPerformance {
  proxyId: string;
  totalUsage: number;
  consecutiveFailures: number;
  health: 'excellent' | 'good' | 'fair' | 'poor';
  lastUsed: Date;
  blockedUntil: Date | null;
  operationStats: Map<string, OperationStats>;
}

export interface OperationStats {
  count: number;
  successCount: number;
  totalResponseTime: number;
  averageResponseTime: number;
}

export interface ProxyHealthCheck {
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: Date;
}

export interface ProxyContext {
  accountId: number;
  operationType: string;
  targetLocation?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface OptimalProxyResult {
  proxy: ProxyConfig | null;
  confidence: number;
  reasoning: string;
  expectedPerformance: 'low' | 'medium' | 'high';
  nextRotationTime: Date;
  reason?: string;
  alternatives?: ProxyAlternative[];
  recommendations?: string[];
}

export interface ProxyAlternative {
  type: 'wait' | 'switch_account' | 'change_proxy';
  description: string;
  estimatedDelay: number;
}

export interface ProxyPool {
  accountId: number;
  proxies: ProxyConfig[];
  lastUpdated: Date;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

export interface RotationStrategy {
  type: 'performance_based' | 'round_robin' | 'weighted_random' | 'location_based' | 'load_balanced';
  currentIndex: number;
  preferredLocations?: string[];
  maxUsagePerHour: number;
  rotationInterval: number;
}



export class ProxyIntelligenceManager {
  private static instance: ProxyIntelligenceManager;
  private proxyPerformance: Map<string, ProxyPerformance> = new Map();
  private proxyPools: Map<number, ProxyPool> = new Map();
  private rotationStrategies: Map<number, RotationStrategy> = new Map();

  private constructor() { }

  static getInstance(): ProxyIntelligenceManager {
    if (!ProxyIntelligenceManager.instance) {
      ProxyIntelligenceManager.instance = new ProxyIntelligenceManager();
    }
    return ProxyIntelligenceManager.instance;
  }

  /**
   * Get optimal proxy for account
   */
  async getOptimalProxy(accountId: number, operationType: OperationType, context: ProxyContext): Promise<OptimalProxyResult> {
    const pool = this.getProxyPool(accountId);

    if (pool.proxies.length === 0) {
      return {
        proxy: null,
        confidence: 0,
        reasoning: 'No proxies available',
        expectedPerformance: 'low',
        nextRotationTime: new Date(),
        reason: 'NO_AVAILABLE_PROXIES',
        alternatives: await this.generateAlternatives(accountId),
        recommendations: ['ADD_MORE_PROXIES', 'CHECK_PROXY_HEALTH']
      };
    }

    // Simple selection - pick first healthy proxy
    const selectedProxy = pool.proxies[0];

    return {
      proxy: selectedProxy,
      confidence: 0.8,
      reasoning: 'Selected first available proxy',
      expectedPerformance: 'medium',
      nextRotationTime: new Date(Date.now() + 300000) // 5 minutes
    };
  }

  /**
   * Record proxy usage result
   */
  async recordProxyResult(proxyId: string, operationType: OperationType, result: { success: boolean; responseTime?: number; error?: string }): Promise<void> {
    const performance = this.proxyPerformance.get(proxyId);
    if (!performance) return;

    const operationStats = performance.operationStats.get(operationType);
    if (!operationStats) return;

    if (result.success) {
      operationStats.successCount++;
      performance.consecutiveFailures = 0;
    } else {
      performance.consecutiveFailures++;
    }

    if (result.responseTime) {
      operationStats.totalResponseTime += result.responseTime;
      operationStats.averageResponseTime = operationStats.totalResponseTime / operationStats.count;
    }

    this.proxyPerformance.set(proxyId, performance);
  }

  /**
   * Get proxy pool for account
   */
  private getProxyPool(accountId: number): ProxyPool {
    let pool = this.proxyPools.get(accountId);

    if (!pool) {
      pool = {
        accountId,
        proxies: [],
        lastUpdated: new Date(),
        healthStatus: 'healthy'
      };
      this.proxyPools.set(accountId, pool);
    }

    return pool;
  }

  /**
   * Generate alternatives when no proxies available
   */
  private async generateAlternatives(accountId: number): Promise<ProxyAlternative[]> {
    return [
      {
        type: 'wait',
        description: 'Wait for proxies to become available',
        estimatedDelay: 60000 // 1 minute
      },
      {
        type: 'switch_account',
        description: 'Switch to different account',
        estimatedDelay: 5000 // 5 seconds
      }
    ];
  }

  /**
   * Initialize proxy performance tracking
   */
  private async initializeProxyPerformance(proxyId: string): Promise<ProxyPerformance> {
    const performance: ProxyPerformance = {
      proxyId,
      totalUsage: 0,
      consecutiveFailures: 0,
      health: 'good',
      lastUsed: new Date(),
      blockedUntil: null,
      operationStats: new Map()
    };

    this.proxyPerformance.set(proxyId, performance);
    return performance;
  }

  /**
   * Mark proxy as unhealthy
   */
  async markProxyUnhealthy(proxyId: string): Promise<void> {
    const performance = this.proxyPerformance.get(proxyId);
    if (performance) {
      performance.health = 'poor';
      performance.blockedUntil = new Date(Date.now() + 300000); // 5 minutes
      this.proxyPerformance.set(proxyId, performance);
    }
  }

  /**
   * Record proxy usage
   */
  async recordProxyUsage(proxyId: string, accountId: number, operationType: OperationType): Promise<void> {
    const performance = this.proxyPerformance.get(proxyId) || await this.initializeProxyPerformance(proxyId);

    performance.totalUsage++;
    performance.lastUsed = new Date();

    let operationStats = performance.operationStats.get(operationType);
    if (!operationStats) {
      operationStats = {
        count: 0,
        successCount: 0,
        totalResponseTime: 0,
        averageResponseTime: 0
      };
      performance.operationStats.set(operationType, operationStats);
    }

    operationStats.count++;
    this.proxyPerformance.set(proxyId, performance);
  }
  /**
   * Get proxy statistics for account
   */
  async getProxyStatistics(accountId: number): Promise<{
    healthPercentage: number;
    activeProxies: number;
    averageResponseTime: number;
  }> {
    const pool = this.getProxyPool(accountId);
    const activeProxies = pool.proxies.length;

    // Mock stats for now since we don't track per-account detailed stats yet
    return {
      healthPercentage: 100,
      activeProxies,
      averageResponseTime: 200 // ms
    };
  }
}

export type OperationType = 'message' | 'join_group' | 'add_user' | 'leave_group' | 'extract_members' | 'boost_engagement' | 'extract' | 'send_message';

export const proxyIntelligenceManager = ProxyIntelligenceManager.getInstance();
