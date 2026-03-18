/**
 * Risk Detection System - نظام كشف المخاطر المتقدم
 * يكتشف المخاطر قبل وقوعها بدقة عالية
 */
export class RiskDetectionSystem {
  private static instance: RiskDetectionSystem;
  private riskModels: Map<string, RiskModel> = new Map();
  private alertHistory: Map<number, AlertRecord[]> = new Map();
  private thresholds: RiskThresholds;

  private constructor() {
    this.thresholds = this.initializeThresholds();
    this.initializeRiskModels();
  }

  static getInstance(): RiskDetectionSystem {
    if (!RiskDetectionSystem.instance) {
      RiskDetectionSystem.instance = new RiskDetectionSystem();
    }
    return RiskDetectionSystem.instance;
  }

  /**
   * تحليل المخاطر الشامل
   */
  async analyzeRisk(
    accountId: number,
    operation: PendingOperation,
    history: OperationHistory
  ): Promise<RiskAssessment> {
    const riskFactors: RiskFactor[] = [];
    let totalRiskScore = 0;
    let riskLevel: RiskLevel = 'low';

    // 1. تحليل المخاطر التاريخية
    const historicalRisk = this.analyzeHistoricalRisk(accountId, history);
    riskFactors.push(historicalRisk);
    totalRiskScore += historicalRisk.score * historicalRisk.weight;

    // 2. تحليل مخاطر العملية
    const operationRisk = this.analyzeOperationRisk(operation);
    riskFactors.push(operationRisk);
    totalRiskScore += operationRisk.score * operationRisk.weight;

    // 3. تحليل مخاطر التوقيت
    const timingRisk = this.analyzeTimingRisk(operation, history);
    riskFactors.push(timingRisk);
    totalRiskScore += timingRisk.score * timingRisk.weight;

    // 4. تحليل مخاطر البروكسي
    const proxyRisk = this.analyzeProxyRisk(operation);
    riskFactors.push(proxyRisk);
    totalRiskScore += proxyRisk.score * proxyRisk.weight;

    // 5. تحليل مخاطر النمط
    const patternRisk = this.analyzePatternRisk(accountId, operation, history);
    riskFactors.push(patternRisk);
    totalRiskScore += patternRisk.score * patternRisk.weight;

    // 6. تحليل المخاطر البيئية
    const environmentalRisk = this.analyzeEnvironmentalRisk(accountId, operation);
    riskFactors.push(environmentalRisk);
    totalRiskScore += environmentalRisk.score * environmentalRisk.weight;

    // حساب مستوى المخاطر النهائي
    riskLevel = this.determineRiskLevel(totalRiskScore);

    // توليد التوصيات
    const recommendations = this.generateRecommendations(riskFactors, riskLevel);

    // التحقق من التنبيهات
    const alerts = this.checkAlerts(accountId, riskFactors, riskLevel);

    return {
      overallRisk: totalRiskScore,
      riskLevel,
      factors: riskFactors,
      recommendations,
      alerts,
      confidence: this.calculateConfidence(riskFactors),
      nextCheckTime: this.calculateNextCheckTime(riskLevel)
    };
  }

  /**
   * تحليل المخاطر التاريخية
   */
  private analyzeHistoricalRisk(accountId: number, history: OperationHistory): RiskFactor {
    let score = 0;
    const details: string[] = [];

    // تحليل معدل النجاح
    const recentSuccess = this.calculateRecentSuccessRate(history);
    if (recentSuccess < 0.5) {
      score += 40;
      details.push(`Low success rate: ${(recentSuccess * 100).toFixed(1)}%`);
    } else if (recentSuccess < 0.8) {
      score += 20;
      details.push(`Moderate success rate: ${(recentSuccess * 100).toFixed(1)}%`);
    }

    // تحليل الفشل المتتالي
    const consecutiveFailures = this.getConsecutiveFailures(history);
    if (consecutiveFailures >= 5) {
      score += 50;
      details.push(`High consecutive failures: ${consecutiveFailures}`);
    } else if (consecutiveFailures >= 3) {
      score += 25;
      details.push(`Moderate consecutive failures: ${consecutiveFailures}`);
    }

    // تحليل الأخطاء الأخيرة
    const recentErrors = this.getRecentErrors(history, 24); // آخر 24 ساعة
    if (recentErrors.length > 10) {
      score += 30;
      details.push(`High error frequency: ${recentErrors.length} errors in 24h`);
    }

    // تحليل قيود Telegram
    const floodWaitErrors = recentErrors.filter(e => e.type === 'FLOOD_WAIT');
    if (floodWaitErrors.length > 3) {
      score += 35;
      details.push(`Multiple flood wait errors: ${floodWaitErrors.length}`);
    }

    const restrictionErrors = recentErrors.filter(e => e.type === 'ACCOUNT_RESTRICTED');
    if (restrictionErrors.length > 0) {
      score += 60;
      details.push(`Account restriction detected: ${restrictionErrors.length}`);
    }

    return {
      type: 'historical',
      score: Math.min(score, 100),
      weight: 0.25,
      details,
      severity: this.determineSeverity(score)
    };
  }

  /**
   * تحليل مخاطر العملية
   */
  private analyzeOperationRisk(operation: PendingOperation): RiskFactor {
    let score = 0;
    const details: string[] = [];

    // تحليل نوع العملية
    const highRiskOperations: OperationType[] = ['add_user', 'join_group'];
    const mediumRiskOperations: OperationType[] = ['message', 'boost_engagement'];

    if (highRiskOperations.includes(operation.type)) {
      score += 30;
      details.push(`High risk operation: ${operation.type}`);
    } else if (mediumRiskOperations.includes(operation.type)) {
      score += 15;
      details.push(`Medium risk operation: ${operation.type}`);
    }

    // تحليل حجم العملية
    if (operation.targetCount > 100) {
      score += 25;
      details.push(`Large operation size: ${operation.targetCount} targets`);
    } else if (operation.targetCount > 50) {
      score += 15;
      details.push(`Medium operation size: ${operation.targetCount} targets`);
    }

    // تحليل سرعة العملية
    if (operation.speed === 'fast') {
      score += 20;
      details.push('High operation speed');
    } else if (operation.speed === 'medium') {
      score += 10;
      details.push('Medium operation speed');
    }

    return {
      type: 'operation',
      score: Math.min(score, 100),
      weight: 0.20,
      details,
      severity: this.determineSeverity(score)
    };
  }

  /**
   * تحليل مخاطر التوقيت
   */
  private analyzeTimingRisk(operation: PendingOperation, history: OperationHistory): RiskFactor {
    let score = 0;
    const details: string[] = [];
    const now = new Date();

    // تحليل توقيت اليوم
    const hour = now.getHours();
    if (hour >= 2 && hour <= 5) {
      score += 25;
      details.push('Unusual operation during sleep hours');
    }

    // تحليل وتيرة العمليات
    const recentOperations = this.getRecentOperations(history, 1); // آخر ساعة
    if (recentOperations.length > 20) {
      score += 35;
      details.push(`High operation frequency: ${recentOperations.length} operations/hour`);
    } else if (recentOperations.length > 10) {
      score += 20;
      details.push(`Moderate operation frequency: ${recentOperations.length} operations/hour`);
    }

    // تحليل الفجوات الزمنية
    const timeGaps = this.calculateTimeGaps(recentOperations);
    const avgGap = timeGaps.reduce((sum, gap) => sum + gap, 0) / timeGaps.length;

    if (avgGap < 60000) { // أقل من دقيقة
      score += 30;
      details.push('Very short time gaps between operations');
    } else if (avgGap < 120000) { // أقل من دقيقتين
      score += 15;
      details.push('Short time gaps between operations');
    }

    return {
      type: 'timing',
      score: Math.min(score, 100),
      weight: 0.20,
      details,
      severity: this.determineSeverity(score)
    };
  }

  /**
   * تحليل مخاطر البروكسي
   */
  private analyzeProxyRisk(operation: PendingOperation): RiskFactor {
    let score = 0;
    const details: string[] = [];

    // تحليل نوع البروكسي
    if (operation.proxy?.type === 'http') {
      score += 10;
      details.push('HTTP proxy (less secure than SOCKS5)');
    }

    // تحليل موقع البروكسي
    if (operation.proxy?.location) {
      const highRiskCountries = ['CN', 'RU', 'IR', 'KP'];
      if (highRiskCountries.includes(operation.proxy.location)) {
        score += 20;
        details.push(`High risk proxy location: ${operation.proxy.location}`);
      }
    }

    // تحليل صحة البروكسي
    if (operation.proxy?.health === 'poor') {
      score += 30;
      details.push('Poor proxy health detected');
    } else if (operation.proxy?.health === 'fair') {
      score += 15;
      details.push('Fair proxy health');
    }

    // تحليل استخدام البروكسي
    const proxyUsage = this.getProxyUsage(operation.proxy?.id);
    if (proxyUsage > 100) {
      score += 25;
      details.push(`High proxy usage: ${proxyUsage} operations`);
    }

    return {
      type: 'proxy',
      score: Math.min(score, 100),
      weight: 0.15,
      details,
      severity: this.determineSeverity(score)
    };
  }

  /**
   * تحليل مخاطر النمط
   */
  private analyzePatternRisk(accountId: number, operation: PendingOperation, history: OperationHistory): RiskFactor {
    let score = 0;
    const details: string[] = [];

    // تحليل أنماط التشغيل
    const patterns = this.detectPatterns(history);

    if (patterns.repetitive) {
      score += 20;
      details.push('Repetitive operation pattern detected');
    }

    if (patterns.robotic) {
      score += 35;
      details.push('Robotic behavior pattern detected');
    }

    if (patterns.unusual) {
      score += 25;
      details.push('Unusual behavior pattern detected');
    }

    // تحليل التباين في السلوك
    const behaviorVariance = this.calculateBehaviorVariance(history);
    if (behaviorVariance < 0.1) {
      score += 30;
      details.push('Low behavior variance (too consistent)');
    }

    return {
      type: 'pattern',
      score: Math.min(score, 100),
      weight: 0.10,
      details,
      severity: this.determineSeverity(score)
    };
  }

  /**
   * تحليل المخاطر البيئية
   */
  private analyzeEnvironmentalRisk(accountId: number, operation: PendingOperation): RiskFactor {
    let score = 0;
    const details: string[] = [];

    // تحميل النظام
    const systemLoad = this.getSystemLoad();
    if (systemLoad > 0.9) {
      score += 20;
      details.push('Very high system load');
    } else if (systemLoad > 0.7) {
      score += 10;
      details.push('High system load');
    }

    // تحليل حالة الشبكة
    const networkQuality = this.getNetworkQuality();
    if (networkQuality === 'poor') {
      score += 15;
      details.push('Poor network quality');
    }

    // تحليل حالة Telegram API
    const apiStatus = this.getTelegramApiStatus();
    if (apiStatus === 'degraded') {
      score += 25;
      details.push('Telegram API degraded');
    } else if (apiStatus === 'unstable') {
      score += 15;
      details.push('Telegram API unstable');
    }

    return {
      type: 'environmental',
      score: Math.min(score, 100),
      weight: 0.10,
      details,
      severity: this.determineSeverity(score)
    };
  }

  /**
   * تحديد مستوى المخاطر
   */
  private determineRiskLevel(score: number): RiskLevel {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }

  /**
   * تحديد شدة المخاطر
   */
  private determineSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  /**
   * توليد التوصيات
   */
  private generateRecommendations(factors: RiskFactor[], riskLevel: RiskLevel): string[] {
    const recommendations: string[] = [];

    // توصيات عامة حسب مستوى المخاطر
    if (riskLevel === 'critical') {
      recommendations.push('STOP_ALL_OPERATIONS');
      recommendations.push('ACTIVATE_EMERGENCY_PROTOCOL');
      recommendations.push('ROTATE_ALL_PROXIES');
    } else if (riskLevel === 'high') {
      recommendations.push('EXTEND_DELAYS_SIGNIFICANTLY');
      recommendations.push('REDUCE_OPERATION_FREQUENCY');
      recommendations.push('USE_DIFFERENT_PROXY');
    } else if (riskLevel === 'medium') {
      recommendations.push('MODERATE_DELAY_EXTENSION');
      recommendations.push('MONITOR_CLOSELY');
    }

    // توصيات خاصة حسب عوامل المخاطر
    factors.forEach(factor => {
      switch (factor.type) {
        case 'historical':
          if (factor.details.some(d => d.includes('success rate'))) {
            recommendations.push('IMPROVE_OPERATION_QUALITY');
          }
          if (factor.details.some(d => d.includes('consecutive failures'))) {
            recommendations.push('IMPLEMENT_COOLDOWN_PERIOD');
          }
          break;
        case 'timing':
          if (factor.details.some(d => d.includes('frequency'))) {
            recommendations.push('REDUCE_OPERATION_FREQUENCY');
          }
          break;
        case 'proxy':
          if (factor.details.some(d => d.includes('health'))) {
            recommendations.push('ROTATE_PROXY_IMMEDIATELY');
          }
          break;
      }
    });

    return [...new Set(recommendations)]; // إزالة التكرارات
  }

  /**
   * التحقق من التنبيهات
   */
  private checkAlerts(accountId: number, factors: RiskFactor[], riskLevel: RiskLevel): Alert[] {
    const alerts: Alert[] = [];

    // تنبيه المخاطر الحرجة
    if (riskLevel === 'critical') {
      alerts.push({
        type: 'CRITICAL_RISK',
        message: 'Critical risk level detected - immediate action required',
        severity: 'critical',
        action: 'STOP_OPERATIONS'
      });
    }

    // تنبيهات خاصة حسب العوامل
    factors.forEach(factor => {
      if (factor.severity === 'critical') {
        alerts.push({
          type: 'FACTOR_CRITICAL',
          message: `Critical ${factor.type} risk: ${factor.details.join(', ')}`,
          severity: 'critical',
          action: 'INVESTIGATE_IMMEDIATELY'
        });
      }

      if (factor.type === 'historical' && factor.details.some(d => d.includes('restriction'))) {
        alerts.push({
          type: 'ACCOUNT_RESTRICTION',
          message: 'Account restriction pattern detected',
          severity: 'high',
          action: 'REVIEW_ACCOUNT_STATUS'
        });
      }
    });

    // حفظ التنبيهات
    const accountAlerts = this.alertHistory.get(accountId) || [];
    accountAlerts.push(...alerts.map(alert => ({
      ...alert,
      timestamp: new Date(),
      accountId
    })));

    // الاحتفاظ بآخر 50 تنبيه فقط
    if (accountAlerts.length > 50) {
      accountAlerts.splice(0, accountAlerts.length - 50);
    }
    this.alertHistory.set(accountId, accountAlerts);

    return alerts;
  }

  /**
   * حساب الثقة في التحليل
   */
  private calculateConfidence(factors: RiskFactor[]): number {
    let confidence = 0.7; // ثقة أساسية

    // زيادة الثقة مع زيادة العوامل
    if (factors.length >= 5) confidence += 0.1;
    if (factors.length >= 7) confidence += 0.1;

    // تقليل الثقة إذا كانت هناك عوامل غير مؤكدة
    const uncertainFactors = factors.filter(f => f.score < 10);
    if (uncertainFactors.length > 0) {
      confidence -= uncertainFactors.length * 0.05;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * حساب وقت الفحص التالي
   */
  private calculateNextCheckTime(riskLevel: RiskLevel): Date {
    const now = new Date();

    switch (riskLevel) {
      case 'critical':
        return new Date(now.getTime() + 5 * 60 * 1000); // 5 دقائق
      case 'high':
        return new Date(now.getTime() + 15 * 60 * 1000); // 15 دقيقة
      case 'medium':
        return new Date(now.getTime() + 30 * 60 * 1000); // 30 دقيقة
      case 'low':
        return new Date(now.getTime() + 60 * 60 * 1000); // ساعة
      default:
        return new Date(now.getTime() + 2 * 60 * 60 * 1000); // ساعتان
    }
  }

  // دوال مساعدة
  private initializeThresholds(): RiskThresholds {
    return {
      critical: 80,
      high: 60,
      medium: 40,
      low: 20
    };
  }

  private initializeRiskModels(): void {
    // تهيئة نماذج المخاطر
    this.riskModels.set('historical', {
      name: 'Historical Risk Model',
      accuracy: 0.85,
      weight: 0.25
    });
    // ... باقي النماذج
  }

  private calculateRecentSuccessRate(history: OperationHistory): number {
    const recentOps = history.operations.slice(-20);
    if (recentOps.length === 0) return 1.0;

    const successfulOps = recentOps.filter(op => op.success).length;
    return successfulOps / recentOps.length;
  }

  private getConsecutiveFailures(history: OperationHistory): number {
    const recentOps = history.operations.slice(-10).reverse();
    let count = 0;

    for (const op of recentOps) {
      if (!op.success) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }

  private getRecentErrors(history: OperationHistory, hours: number): ErrorRecord[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return history.operations
      .filter(op => !op.success && op.timestamp > cutoff)
      .map(op => ({
        type: op.errorType || 'UNKNOWN',
        timestamp: op.timestamp,
        message: op.errorMessage || 'No message'
      }));
  }

  private getRecentOperations(history: OperationHistory, hours: number): Operation[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return history.operations.filter(op => op.timestamp > cutoff);
  }

  private calculateTimeGaps(operations: Operation[]): number[] {
    const gaps: number[] = [];
    for (let i = 1; i < operations.length; i++) {
      gaps.push(operations[i].timestamp.getTime() - operations[i - 1].timestamp.getTime());
    }
    return gaps;
  }

  private getProxyUsage(proxyId?: string): number {
    // سيتم تنفيذها لاحقاً
    return 0;
  }

  private detectPatterns(history: OperationHistory): PatternAnalysis {
    // سيتم تنفيذها لاحقاً
    return {
      repetitive: false,
      robotic: false,
      unusual: false,
      severity: 0,
      isRepetitive: false,
      isBurst: false
    };
  }

  private calculateBehaviorVariance(history: OperationHistory): number {
    // سيتم تنفيذها لاحقاً
    return 0.5;
  }

  private getSystemLoad(): number {
    // سيتم تنفيذها لاحقاً
    return 0.5;
  }

  private getNetworkQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    // سيتم تنفيذها لاحقاً
    return 'good';
  }

  /**
   * اكتشاف الأنماط (Public API)
   */
  async detectPattern(accountId: number): Promise<PatternAnalysis> {
    // In a real implementation, this would fetch history from DB
    // For now, return a safe default
    return {
      repetitive: false,
      robotic: false,
      unusual: false,
      severity: 0,
      isRepetitive: false,
      isBurst: false
    };
  }

  private getTelegramApiStatus(): 'excellent' | 'good' | 'degraded' | 'unstable' {
    // سيتم تنفيذها لاحقاً
    return 'good';
  }
}

// التصدير والأنواع
export const riskDetection = RiskDetectionSystem.getInstance();

// أنواع البيانات
interface RiskModel {
  name: string;
  accuracy: number;
  weight: number;
}

interface RiskThresholds {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface RiskAssessment {
  overallRisk: number;
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  recommendations: string[];
  alerts: Alert[];
  confidence: number;
  nextCheckTime: Date;
}

export interface RiskFactor {
  type: string;
  score: number;
  weight: number;
  details: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface Alert {
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: string;
}

export interface AlertRecord extends Alert {
  timestamp: Date;
  accountId: number;
}

export interface PendingOperation {
  type: OperationType;
  targetCount: number;
  speed: 'slow' | 'medium' | 'fast';
  proxy?: {
    id?: string;
    type: string;
    location?: string;
    health: 'excellent' | 'good' | 'fair' | 'poor';
  };
}

export interface OperationHistory {
  operations: Operation[];
}

// Export alias for compatibility
export const RiskDetector = RiskDetectionSystem;

interface Operation {
  timestamp: Date;
  type: OperationType;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
}

interface ErrorRecord {
  type: string;
  timestamp: Date;
  message: string;
}

interface PatternAnalysis {
  repetitive: boolean;
  robotic: boolean;
  unusual: boolean;
  severity: number;
  isRepetitive: boolean;
  isBurst: boolean;
}

type RiskLevel = 'minimal' | 'low' | 'medium' | 'high' | 'critical';
type OperationType = 'message' | 'join_group' | 'add_user' | 'leave_group' | 'extract_members' | 'boost_engagement';
