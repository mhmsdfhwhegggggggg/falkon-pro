/**
 * Anti-Ban ML Engine - Basic machine learning for ban detection
 * Provides pattern recognition and risk assessment
 */

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  factors: string[];
  recommendations: string[];
}

export interface OperationPattern {
  type: string;
  frequency: number;
  timing: number[];
  successRate: number;
  averageDelay: number;
}

export class AntiBanMLEngine {
  private static instance: AntiBanMLEngine;
  private patterns: Map<number, OperationPattern[]> = new Map();

  private constructor() {}

  static getInstance(): AntiBanMLEngine {
    if (!this.instance) {
      this.instance = new AntiBanMLEngine();
    }
    return this.instance;
  }

  /**
   * Analyze operation patterns and assess risk
   */
  analyzeRisk(accountId: number, recentOperations: any[]): RiskAssessment {
    const patterns = this.extractPatterns(recentOperations);
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Analyze frequency
    const highFrequency = patterns.some(p => p.frequency > 50);
    if (highFrequency) {
      riskFactors.push('HIGH_OPERATION_FREQUENCY');
      riskScore += 30;
    }

    // Analyze success rate
    const lowSuccessRate = patterns.some(p => p.successRate < 70);
    if (lowSuccessRate) {
      riskFactors.push('LOW_SUCCESS_RATE');
      riskScore += 25;
    }

    // Analyze timing patterns
    const irregularTiming = patterns.some(p => this.isIrregularTiming(p.timing));
    if (irregularTiming) {
      riskFactors.push('IRREGULAR_TIMING');
      riskScore += 20;
    }

    // Analyze operation diversity
    const limitedDiversity = patterns.length < 3;
    if (limitedDiversity) {
      riskFactors.push('LIMITED_OPERATION_DIVERSITY');
      riskScore += 15;
    }

    // Determine risk level
    let riskLevel: RiskAssessment['riskLevel'];
    if (riskScore >= 70) {
      riskLevel = 'critical';
    } else if (riskScore >= 50) {
      riskLevel = 'high';
    } else if (riskScore >= 30) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    const recommendations = this.generateRecommendations(riskLevel, riskFactors);

    return {
      riskLevel,
      riskScore,
      factors: riskFactors,
      recommendations
    };
  }

  /**
   * Generate recommendations based on risk level and factors
   */
  private generateRecommendations(riskLevel: RiskAssessment['riskLevel'], riskFactors: string[]): string[] {
    const recommendations: string[] = [];
    
    switch (riskLevel) {
      case 'critical':
        recommendations.push('STOP_ALL_OPERATIONS');
        recommendations.push('SWITCH_ALL_ACCOUNTS');
        recommendations.push('CHANGE_ALL_PROXIES');
        break;
      case 'high':
        recommendations.push('REDUCE_OPERATION_FREQUENCY');
        recommendations.push('INCREASE_DELAYS');
        recommendations.push('ROTATE_PROXIES');
        break;
      case 'medium':
        recommendations.push('MODERATE_OPERATION_FREQUENCY');
        recommendations.push('MONITOR_ACCOUNT_HEALTH');
        break;
      case 'low':
        recommendations.push('CONTINUE_WITH_CAUTION');
        break;
    }
    
    if (riskFactors.includes('HIGH_OPERATION_FREQUENCY')) {
      recommendations.push('INCREASE_DELAY_BETWEEN_OPERATIONS');
    }
    
    if (riskFactors.includes('LOW_SUCCESS_RATE')) {
      recommendations.push('CHECK_ACCOUNT_STATUS');
      recommendations.push('VERIFY_PROXY_QUALITY');
    }
    
    if (riskFactors.includes('IRREGULAR_TIMING')) {
      recommendations.push('IMPLEMENT_RANDOM_DELAYS');
    }
    
    if (riskFactors.includes('LIMITED_OPERATION_DIVERSITY')) {
      recommendations.push('DIVERSIFY_OPERATION_TYPES');
    }
    
    return recommendations;
  }

  /**
   * Extract patterns from recent operations
   */
  private extractPatterns(recentOperations: any[]): OperationPattern[] {
    // Group operations by type
    const operationGroups = new Map<string, any[]>();
    recentOperations.forEach(op => {
      const type = op.type || 'unknown';
      if (!operationGroups.has(type)) {
        operationGroups.set(type, []);
      }
      operationGroups.get(type)!.push(op);
    });
    
    // Convert to patterns
    const patterns: OperationPattern[] = [];
    operationGroups.forEach((operations, type) => {
      const timing = operations.map(op => op.timestamp || Date.now());
      const successCount = operations.filter(op => op.success).length;
      
      patterns.push({
        type,
        frequency: operations.length,
        timing,
        successRate: (successCount / operations.length) * 100,
        averageDelay: this.calculateAverageDelay(timing)
      });
    });
    
    return patterns;
  }
  
  /**
   * Check if timing pattern is irregular
   */
  private isIrregularTiming(timing: number[]): boolean {
    if (timing.length < 2) return false;
    
    const delays = [];
    for (let i = 1; i < timing.length; i++) {
      delays.push(timing[i] - timing[i-1]);
    }
    
    const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
    const variance = delays.reduce((sum, delay) => sum + Math.pow(delay - avgDelay, 2), 0) / delays.length;
    const stdDev = Math.sqrt(variance);
    
    // Consider irregular if standard deviation is more than 50% of average
    return stdDev > (avgDelay * 0.5);
  }
  
  /**
   * Calculate average delay between operations
   */
  private calculateAverageDelay(timing: number[]): number {
    if (timing.length < 2) return 0;
    
    const delays = [];
    for (let i = 1; i < timing.length; i++) {
      delays.push(timing[i] - timing[i-1]);
    }
    
    return delays.reduce((a, b) => a + b, 0) / delays.length;
  }
}

// Export alias for compatibility
export const AntiBanEngine = AntiBanMLEngine;
