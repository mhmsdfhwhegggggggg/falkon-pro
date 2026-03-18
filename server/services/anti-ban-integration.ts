import { antiBanCore, OperationDecision, OperationResult } from './anti-ban-core';
import { smartDelaySystem, SmartDelay, CompletedOperation } from './smart-delay-system';
import { riskDetection, RiskAssessment, PendingOperation, OperationHistory } from './risk-detection';
import { proxyIntelligenceManager, OptimalProxyResult } from './proxy-intelligence';
import { AntiBanMLEngine } from './anti-ban-ml-engine';
import { antiBanMonitoring } from './anti-ban-monitoring';

/**
 * Anti-Ban Integration System - تكامل جميع أنظمة الحماية
 * نقطة الدخول الموحدة لجميع عمليات الحماية من الحظر
 */
export class AntiBanIntegration {
  private static instance: AntiBanIntegration;

  private constructor() { }

  static getInstance(): AntiBanIntegration {
    if (!AntiBanIntegration.instance) {
      AntiBanIntegration.instance = new AntiBanIntegration();
    }
    return AntiBanIntegration.instance;
  }

  /**
   * النقطة الرئيسية لجميع العمليات - التحقق قبل التنفيذ
   */
  async preOperationCheck(accountId: number, operation: OperationRequest): Promise<OperationApproval> {
    try {
      // 1. التحقق الأساسي من النظام الأساسي
      const coreDecision = await antiBanCore.preOperationCheck(
        accountId,
        operation.type,
        operation.targetInfo
      );

      if (!coreDecision.allowed) {
        return {
          approved: false,
          reason: coreDecision.reason,
          retryAfter: coreDecision.retryAfter ? new Date(Date.now() + coreDecision.retryAfter) : undefined,
          recommendations: ['WAIT_AND_RETRY'],
          riskLevel: 'critical'
        };
      }

      // 2. تحليل المخاطر المتقدم
      const riskAssessment = await riskDetection.analyzeRisk(
        accountId,
        this.convertToPendingOperation(operation),
        await this.getOperationHistory(accountId)
      );

      // 3. الحصول على البروكسي الأمثل
      const proxyResult = await proxyIntelligenceManager.getOptimalProxy(
        accountId,
        operation.type,
        this.convertToProxyContext(operation, riskAssessment)
      );

      if (!proxyResult.proxy) {
        return {
          approved: false,
          reason: proxyResult.reason,
          recommendations: proxyResult.recommendations || ['ADD_MORE_PROXIES'],
          riskLevel: 'high'
        };
      }

      // 4. حساب التأخير الذكي
      const smartDelay = smartDelaySystem.calculateDelay(
        accountId,
        operation.type,
        this.convertToDelayContext(operation, riskAssessment)
      );

      // 5. دمج جميع القرارات
      const finalDecision = this.mergeDecisions(
        coreDecision,
        riskAssessment,
        proxyResult,
        smartDelay
      );

      return {
        approved: finalDecision.approved,
        delay: finalDecision.delay,
        proxy: proxyResult.proxy,
        reason: finalDecision.reason,
        recommendations: finalDecision.recommendations,
        riskLevel: riskAssessment.riskLevel,
        confidence: this.calculateOverallConfidence(coreDecision, riskAssessment, proxyResult, smartDelay),
        monitoring: {
          riskScore: riskAssessment.overallRisk,
          proxyHealth: proxyResult.expectedPerformance,
          delayQuality: smartDelay.confidence,
          nextCheckTime: riskAssessment.nextCheckTime
        }
      };

    } catch (error) {
      return {
        approved: false,
        reason: 'SYSTEM_ERROR',
        recommendations: ['CONTACT_ADMIN'],
        riskLevel: 'critical',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * تسجيل نتيجة العملية بعد التنفيذ
   */
  async recordOperationResult(
    accountId: number,
    operation: OperationRequest,
    result: OperationExecutionResult
  ): Promise<void> {
    try {
      // 1. تسجيل في النظام الأساسي
      await antiBanCore.recordOperationResult(
        accountId,
        operation.type,
        result.success,
        result.errorType
      );

      // 2. تحديث نظام التأخير الذكي
      smartDelaySystem.updateBehaviorPattern(accountId, {
        type: operation.type,
        success: result.success,
        actualDelay: result.actualDelay,
        timestamp: new Date(),
        errorType: result.errorType
      });

      // 3. تسجيل نتيجة البروكسي
      if (result.proxyUsed) {
        await proxyIntelligenceManager.recordProxyResult(
          result.proxyUsed.toString(),
          operation.type,
          {
            success: result.success,
            responseTime: result.responseTime,
            error: result.errorMessage
          }
        );
      }

    } catch (error) {
      console.error('Error recording operation result:', error);
    }
  }

  /**
   * الحصول على حالة الحساب الشاملة
   */
  async getAccountStatus(accountId: number): Promise<ComprehensiveAccountStatus> {
    try {
      // 1. حالة النظام الأساسي
      const coreStatus = antiBanCore.getAccountStatus(accountId);

      // 2. إحصائيات التأخير الذكي
      const delayStats = smartDelaySystem.getPerformanceStats(accountId);

      // 3. إحصائيات البروكسي
      const proxyStats = await proxyIntelligenceManager.getProxyStatistics(accountId);

      // 4. تقييم الصحة العامة
      const healthScore = this.calculateOverallHealthScore(coreStatus, delayStats, proxyStats);

      return {
        accountId,
        healthScore,
        status: coreStatus,
        delayStatistics: delayStats,
        proxyStatistics: proxyStats,
        recommendations: this.generateAccountRecommendations(healthScore, coreStatus, delayStats, proxyStats),
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('Error getting account status:', error);
      return {
        accountId,
        healthScore: 0,
        status: null,
        delayStatistics: null,
        proxyStatistics: null,
        recommendations: ['CHECK_SYSTEM_STATUS'],
        lastUpdated: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * الحصول على إحصائيات النظام الشاملة
   */
  async getSystemStatistics(): Promise<SystemStatistics> {
    try {
      // سيتم تنفيذها لاحقاً مع جمع البيانات من جميع الأنظمة
      return {
        totalAccounts: 0,
        healthyAccounts: 0,
        averageRiskScore: 0,
        totalProxies: 0,
        healthyProxies: 0,
        averageDelay: 0,
        systemLoad: 0,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting system statistics:', error);
      return {
        totalAccounts: 0,
        healthyAccounts: 0,
        averageRiskScore: 0,
        totalProxies: 0,
        healthyProxies: 0,
        averageDelay: 0,
        systemLoad: 0,
        lastUpdated: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * دمج جميع القرارات
   */
  private mergeDecisions(
    coreDecision: OperationDecision,
    riskAssessment: RiskAssessment,
    proxyResult: OptimalProxyResult,
    smartDelay: SmartDelay
  ): MergedDecision {
    let approved = coreDecision.allowed;
    let finalDelay = Math.max(
      antiBanCore.getRecommendedDelay(0, 'message'), // coreDecision.suggestedDelay doesn't exist, use method
      smartDelay.delay
    );
    let reason = coreDecision.reason || '';
    const recommendations: string[] = [];

    // دمج التوصيات
    recommendations.push(...riskAssessment.recommendations);
    if (proxyResult.recommendations) {
      recommendations.push(...proxyResult.recommendations);
    }

    // تعديل القرار بناءً على المخاطر
    if (riskAssessment.riskLevel === 'critical') {
      approved = false;
      reason = 'CRITICAL_RISK_DETECTED';
      finalDelay = Math.max(finalDelay, 5 * 60 * 1000); // 5 دقائق على الأقل
    } else if (riskAssessment.riskLevel === 'high') {
      finalDelay *= 2; // مضاعفة التأخير للمخاطر العالية
      recommendations.push('EXTENDED_DELAY');
    }

    // تعديل التأخير بناءً على البروكسي
    if (proxyResult.expectedPerformance === 'low') {
      finalDelay *= 1.5;
      recommendations.push('PROXY_PERFORMANCE_POOR');
    }

    return {
      approved,
      delay: finalDelay,
      reason,
      recommendations: [...new Set(recommendations)] // إزالة التكرارات
    };
  }

  /**
   * حساب الثقة العامة
   */
  private calculateOverallConfidence(
    coreDecision: OperationDecision,
    riskAssessment: RiskAssessment,
    proxyResult: OptimalProxyResult,
    smartDelay: SmartDelay
  ): number {
    const coreConfidence = 0.8; // ثقة النظام الأساسي
    const riskConfidence = riskAssessment.confidence;
    const proxyConfidence = proxyResult.confidence || 0.5;
    const delayConfidence = smartDelay.confidence;

    // متوسط مرجح
    return (coreConfidence * 0.3 + riskConfidence * 0.3 + proxyConfidence * 0.2 + delayConfidence * 0.2);
  }

  /**
   * حساب درجة الصحة العامة
   */
  private calculateOverallHealthScore(
    coreStatus: any,
    delayStats: any,
    proxyStats: any
  ): number {
    let score = 50; // نقطة بداية

    // إضافة نقاط بناءً على حالة النظام الأساسي
    if (coreStatus?.isHealthy) score += 20;
    if (coreStatus?.canOperate) score += 10;

    // إضافة نقاط بناءً على إحصائيات التأخير
    if (delayStats?.averageSuccessRate > 0.9) score += 10;
    if (delayStats?.consistencyScore > 0.8) score += 5;

    // إضافة نقاط بناءً على إحصائيات البروكسي
    if (proxyStats?.healthPercentage > 80) score += 10;
    if (proxyStats?.averageResponseTime < 2000) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * توليد توصيات الحساب
   */
  private generateAccountRecommendations(
    healthScore: number,
    coreStatus: any,
    delayStats: any,
    proxyStats: any
  ): string[] {
    const recommendations: string[] = [];

    if (healthScore < 50) {
      recommendations.push('ACCOUNT_NEEDS_ATTENTION');
    }

    if (!coreStatus?.isHealthy) {
      recommendations.push('IMPROVE_ACCOUNT_HEALTH');
    }

    if (delayStats?.averageSuccessRate < 0.8) {
      recommendations.push('OPTIMIZE_OPERATION_TIMING');
    }

    if (proxyStats?.healthPercentage < 70) {
      recommendations.push('IMPROVE_PROXY_QUALITY');
    }

    if (recommendations.length === 0) {
      recommendations.push('ACCOUNT_PERFORMING_WELL');
    }

    return recommendations;
  }

  // دوال تحويل النواع
  private convertToPendingOperation(operation: OperationRequest): PendingOperation {
    return {
      type: operation.type,
      targetCount: operation.targetCount || 1,
      speed: operation.speed || 'medium',
      proxy: operation.currentProxy
    };
  }

  private convertToProxyContext(operation: OperationRequest, riskAssessment: RiskAssessment): any {
    return {
      operationRisk: riskAssessment.riskLevel,
      preferredLocation: operation.preferredLocation,
      maxResponseTime: operation.maxResponseTime,
      requiredReliability: operation.requiredReliability
    };
  }

  private convertToDelayContext(operation: OperationRequest, riskAssessment: RiskAssessment): any {
    return {
      consecutiveFailures: operation.consecutiveFailures || 0,
      accountAge: operation.accountAge || 30,
      systemLoad: operation.systemLoad || 0.5,
      lastOperationTime: operation.lastOperationTime,
      targetRisk: riskAssessment.riskLevel
    };
  }

  private async getOperationHistory(accountId: number): Promise<OperationHistory> {
    // سيتم تنفيذها لاحقاً مع جلب البيانات من قاعدة البيانات
    return {
      operations: []
    };
  }
}

// التصدير والأنواع
export const antiBanIntegration = AntiBanIntegration.getInstance();

// أنواع البيانات
export interface OperationRequest {
  type: OperationType;
  targetCount?: number;
  speed?: 'slow' | 'medium' | 'fast';
  targetInfo?: any;
  currentProxy?: any;
  preferredLocation?: string;
  maxResponseTime?: number;
  requiredReliability?: number;
  consecutiveFailures?: number;
  accountAge?: number;
  systemLoad?: number;
  lastOperationTime?: Date;
}

export interface OperationApproval {
  approved: boolean;
  delay?: number;
  proxy?: any;
  reason?: string;
  retryAfter?: Date;
  recommendations?: string[];
  riskLevel?: RiskLevel;
  confidence?: number;
  monitoring?: {
    riskScore: number;
    proxyHealth: string;
    delayQuality: number;
    nextCheckTime: Date;
  };
  error?: string;
}

export interface OperationExecutionResult {
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  duration?: number;
  actualDelay?: number;
  responseTime?: number;
  proxyUsed?: any;
}

export interface ComprehensiveAccountStatus {
  accountId: number;
  healthScore: number;
  status: any;
  delayStatistics: any;
  proxyStatistics: any;
  recommendations: string[];
  lastUpdated: Date;
  error?: string;
}

export interface SystemStatistics {
  totalAccounts: number;
  healthyAccounts: number;
  averageRiskScore: number;
  totalProxies: number;
  healthyProxies: number;
  averageDelay: number;
  systemLoad: number;
  lastUpdated: Date;
  error?: string;
}

interface MergedDecision {
  approved: boolean;
  delay: number;
  reason: string;
  recommendations: string[];
}

type OperationType = 'message' | 'join_group' | 'add_user' | 'leave_group' | 'extract_members' | 'boost_engagement';
type RiskLevel = 'minimal' | 'low' | 'medium' | 'high' | 'critical';
