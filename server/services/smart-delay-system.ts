/**
 * Smart Delay System - نظام التأخير الذكي
 * يوفر تأخيرات متكيفة ومحاكاة سلوك بشري متقدم
 */
export class SmartDelaySystem {
  private static instance: SmartDelaySystem;
  private accountPatterns: Map<number, BehaviorPattern> = new Map();
  private timeWindows: Map<number, TimeWindow[]> = new Map();

  private constructor() { }

  static getInstance(): SmartDelaySystem {
    if (!SmartDelaySystem.instance) {
      SmartDelaySystem.instance = new SmartDelaySystem();
    }
    return SmartDelaySystem.instance;
  }

  /**
   * حساب تأخير ذكي متقدم
   */
  calculateDelay(accountId: number, operationType: OperationType, context: DelayContext): SmartDelay {
    const pattern = this.getBehaviorPattern(accountId);
    const timeWindows = this.getTimeWindows(accountId);

    // 1. التأخير الأساسي حسب نوع العملية
    const baseDelay = this.getBaseDelay(operationType);

    // 2. تعديل حسب نمط السلوك
    const behaviorMultiplier = this.calculateBehaviorMultiplier(pattern, operationType);

    // 3. تعديل حسب النافذة الزمنية
    const timeMultiplier = this.calculateTimeMultiplier(timeWindows, new Date());

    // 4. تعديل حسب السياق
    const contextMultiplier = this.calculateContextMultiplier(context);

    // 5. إضافة عشوائية ذكية
    const randomization = this.calculateSmartRandomization(baseDelay, pattern);

    // 6. حساب التأخير النهائي
    let finalDelay = baseDelay * behaviorMultiplier * timeMultiplier * contextMultiplier;
    finalDelay += randomization;

    // 7. تطبيق الحدود
    finalDelay = Math.max(500, Math.min(finalDelay, 120000)); // بين 0.5 ثانية و دقيقتين

    return {
      delay: Math.round(finalDelay),
      confidence: this.calculateConfidence(pattern, context),
      reasoning: this.generateDelayReasoning(baseDelay, behaviorMultiplier, timeMultiplier, contextMultiplier),
      nextRecommendedDelay: this.predictNextDelay(accountId, operationType, finalDelay)
    };
  }

  /**
   * تحديث نمط السلوك بعد كل عملية
   */
  updateBehaviorPattern(accountId: number, operation: CompletedOperation): void {
    const pattern = this.getBehaviorPattern(accountId);

    // تحديث إحصائيات العملية
    const stats = pattern.operationStats.get(operation.type) || {
      count: 0,
      totalDelay: 0,
      averageDelay: 0,
      successRate: 0,
      lastUsed: new Date()
    };

    stats.count++;
    stats.totalDelay += operation.actualDelay || 0;
    stats.averageDelay = stats.totalDelay / stats.count;
    stats.successRate = operation.success ?
      (stats.successRate * (stats.count - 1) + 1) / stats.count :
      (stats.successRate * (stats.count - 1)) / stats.count;
    stats.lastUsed = new Date();

    pattern.operationStats.set(operation.type, stats);

    // تحديث النوافذ الزمنية
    this.updateTimeWindows(accountId, operation);

    // حفظ النمط المحدث
    this.accountPatterns.set(accountId, pattern);
  }

  /**
   * الحصول على نمط السلوك
   */
  private getBehaviorPattern(accountId: number): BehaviorPattern {
    let pattern = this.accountPatterns.get(accountId);

    if (!pattern) {
      pattern = {
        accountId,
        avgDelay: 3000,
        delayVariance: 1000,
        operationFrequency: new Map(),
        peakHours: [9, 10, 14, 15, 20, 21], // ساعات الذروة
        sleepHours: [2, 3, 4, 5], // ساعات النوم
        operationStats: new Map(),
        lastActivity: new Date(),
        consistencyScore: 0.8
      };
      this.accountPatterns.set(accountId, pattern);
    }

    return pattern;
  }

  /**
   * الحصول على النوافذ الزمنية
   */
  private getTimeWindows(accountId: number): TimeWindow[] {
    let windows = this.timeWindows.get(accountId);

    if (!windows) {
      windows = this.initializeTimeWindows();
      this.timeWindows.set(accountId, windows);
    }

    return windows;
  }

  /**
   * تهيئة النوافذ الزمنية
   */
  private initializeTimeWindows(): TimeWindow[] {
    const windows: TimeWindow[] = [];
    const now = new Date();

    // إنشاء نوافذ لآخر 24 ساعة
    for (let i = 0; i < 24; i++) {
      const windowStart = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      windows.push({
        startHour: windowStart.getHours(),
        operationCount: 0,
        totalDelay: 0,
        averageDelay: 0,
        riskLevel: 'low'
      });
    }

    return windows;
  }

  /**
   * الحصول على التأخير الأساسي
   */
  private getBaseDelay(operationType: OperationType): number {
    const delays = {
      'message': 2000,
      'join_group': 8000,
      'add_user': 5000,
      'leave_group': 3000,
      'extract_members': 15000,
      'boost_engagement': 4000
    };

    return delays[operationType] || 3000;
  }

  /**
   * حساب مضاعف السلوك
   */
  private calculateBehaviorMultiplier(pattern: BehaviorPattern, operationType: OperationType): number {
    const stats = pattern.operationStats.get(operationType);

    if (!stats) return 1.0;

    // إذا كان معدل النجاح منخفضاً، زد التأخير
    if (stats.successRate < 0.7) return 1.5;
    if (stats.successRate < 0.9) return 1.2;

    // إذا كان التأخير المتوسط منخفضاً جداً، زده قليلاً
    if (stats.averageDelay < 1000) return 1.3;

    return 1.0;
  }

  /**
   * حساب مضاعف الوقت
   */
  private calculateTimeMultiplier(windows: TimeWindow[], currentTime: Date): number {
    const currentHour = currentTime.getHours();
    const currentWindow = windows.find(w => w.startHour === currentHour);

    if (!currentWindow) return 1.0;

    // إذا كانت النافذة الحالية مزدحمة، زد التأخير
    if (currentWindow.operationCount > 20) return 2.0;
    if (currentWindow.operationCount > 10) return 1.5;

    // ساعات الذروة تتطلب تأخير أقل (محاكاة نشاط عادي)
    const peakHours = [9, 10, 14, 15, 20, 21];
    if (peakHours.includes(currentHour)) return 0.8;

    // ساعات النوم تتطلب تأخير أعلى
    const sleepHours = [2, 3, 4, 5];
    if (sleepHours.includes(currentHour)) return 3.0;

    return 1.0;
  }

  /**
   * حساب مضاعف السياق
   */
  private calculateContextMultiplier(context: DelayContext): number {
    let multiplier = 1.0;

    // إذا كان هناك فشل متتالي، زد التأخير
    if (context.consecutiveFailures > 0) {
      multiplier *= Math.pow(1.5, context.consecutiveFailures);
    }

    // إذا كان الحساب جديداً، زد التأخير
    if (context.accountAge < 7) { // أقل من 7 أيام
      multiplier *= 2.0;
    } else if (context.accountAge < 30) { // أقل من 30 يوم
      multiplier *= 1.5;
    }

    // إذا كان هناك ضغط عالٍ، زد التأخير
    if (context.systemLoad > 0.8) {
      multiplier *= 1.5;
    }

    return multiplier;
  }

  /**
   * حساب العشوائية الذكية
   */
  private calculateSmartRandomization(baseDelay: number, pattern: BehaviorPattern): number {
    // عشوائية تعتمد على التأخير الأساسي ونمط السلوك
    const variance = pattern.delayVariance || baseDelay * 0.3;

    // استخدام توزيع طبيعي بدلاً من التوزيع المنتظم
    const randomFactor = this.gaussianRandom() * variance;

    return randomFactor;
  }

  /**
   * توليد رقم عشوائي بتوزيع طبيعي
   */
  private gaussianRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * حساب الثقة في التأخير المقترح
   */
  private calculateConfidence(pattern: BehaviorPattern, context: DelayContext): number {
    let confidence = 0.8; // ثقة أساسية

    // زيادة الثقة مع زيادة البيانات التاريخية
    const totalOperations = Array.from(pattern.operationStats.values())
      .reduce((sum, stats) => sum + stats.count, 0);

    if (totalOperations > 100) confidence += 0.1;
    if (totalOperations > 500) confidence += 0.1;

    // تقليل الثقة مع الفشل المتتالي
    if (context.consecutiveFailures > 0) {
      confidence -= context.consecutiveFailures * 0.1;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * توليد تفسير التأخير
   */
  private generateDelayReasoning(
    baseDelay: number,
    behaviorMultiplier: number,
    timeMultiplier: number,
    contextMultiplier: number
  ): string {
    const reasons = [];

    reasons.push(`Base delay: ${baseDelay}ms`);

    if (behaviorMultiplier !== 1.0) {
      reasons.push(`Behavior adjustment: x${behaviorMultiplier.toFixed(2)}`);
    }

    if (timeMultiplier !== 1.0) {
      reasons.push(`Time adjustment: x${timeMultiplier.toFixed(2)}`);
    }

    if (contextMultiplier !== 1.0) {
      reasons.push(`Context adjustment: x${contextMultiplier.toFixed(2)}`);
    }

    return reasons.join(', ');
  }

  /**
   * التنبؤ بالتأخير التالي
   */
  private predictNextDelay(
    accountId: number,
    operationType: OperationType,
    currentDelay: number
  ): number {
    const pattern = this.getBehaviorPattern(accountId);
    const stats = pattern.operationStats.get(operationType);

    if (!stats) return currentDelay;

    // التنبؤ بناءً على المتوسط التاريخي
    const historicalAverage = stats.averageDelay;

    // مزج بين التأخير الحالي والمتوسط التاريخي
    const predictedDelay = (currentDelay * 0.7) + (historicalAverage * 0.3);

    return Math.round(predictedDelay);
  }

  /**
   * تحديث النوافذ الزمنية
   */
  private updateTimeWindows(accountId: number, operation: CompletedOperation): void {
    const windows = this.getTimeWindows(accountId);
    const currentHour = new Date().getHours();
    const currentWindow = windows.find(w => w.startHour === currentHour);

    if (currentWindow) {
      currentWindow.operationCount++;
      if (operation.actualDelay) {
        currentWindow.totalDelay += operation.actualDelay;
        currentWindow.averageDelay = currentWindow.totalDelay / currentWindow.operationCount;
      }

      // تحديث مستوى المخاطر
      if (currentWindow.operationCount > 20) {
        currentWindow.riskLevel = 'high';
      } else if (currentWindow.operationCount > 10) {
        currentWindow.riskLevel = 'medium';
      }
    }
  }

  /**
   * الحصول على إحصائيات الأداء
   */
  getPerformanceStats(accountId: number): PerformanceStats | null {
    const pattern = this.accountPatterns.get(accountId);
    const windows = this.timeWindows.get(accountId);

    if (!pattern) return null;

    const totalOperations = Array.from(pattern.operationStats.values())
      .reduce((sum, stats) => sum + stats.count, 0);

    const averageSuccessRate = Array.from(pattern.operationStats.values())
      .reduce((sum, stats) => sum + stats.successRate, 0) / pattern.operationStats.size;

    return {
      totalOperations,
      averageDelay: pattern.avgDelay,
      consistencyScore: pattern.consistencyScore,
      averageSuccessRate,
      peakHours: pattern.peakHours,
      lastActivity: pattern.lastActivity
    };
  }
}

// التصدير والأنواع
export const smartDelaySystem = SmartDelaySystem.getInstance();

// أنواع البيانات
interface BehaviorPattern {
  accountId: number;
  avgDelay: number;
  delayVariance: number;
  operationFrequency: Map<string, number>;
  peakHours: number[];
  sleepHours: number[];
  operationStats: Map<string, OperationStats>;
  lastActivity: Date;
  consistencyScore: number;
}

interface TimeWindow {
  startHour: number;
  operationCount: number;
  totalDelay: number;
  averageDelay: number;
  riskLevel: 'low' | 'medium' | 'high';
}

interface OperationStats {
  count: number;
  totalDelay: number;
  averageDelay: number;
  successRate: number;
  lastUsed: Date;
}

interface DelayContext {
  consecutiveFailures: number;
  accountAge: number; // بالأيام
  systemLoad: number; // 0-1
  lastOperationTime?: Date;
  targetRisk?: 'low' | 'medium' | 'high';
}

export interface SmartDelay {
  delay: number;
  confidence: number;
  reasoning: string;
  nextRecommendedDelay: number;
}

export interface CompletedOperation {
  type: OperationType;
  success: boolean;
  actualDelay?: number;
  timestamp: Date;
  errorType?: string;
}

interface PerformanceStats {
  totalOperations: number;
  averageDelay: number;
  consistencyScore: number;
  averageSuccessRate: number;
  peakHours: number[];
  lastActivity: Date;
}

type OperationType = 'message' | 'join_group' | 'add_user' | 'leave_group' | 'extract_members' | 'boost_engagement';
