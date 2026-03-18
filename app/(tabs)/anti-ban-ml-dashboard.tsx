import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { trpc } from '@/lib/trpc';

/**
 * Anti-Ban Machine Learning Dashboard
 * 
 * Advanced ML monitoring and control interface
 * Features:
 * - Model performance metrics
 * - Training progress
 * - Prediction accuracy
 * - Anomaly detection
 * - Pattern recognition
 */
export default function AntiBanMLDashboardScreen() {
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // tRPC queries
  const { data: mlStats, refetch: refetchML } = (trpc.antiBan as any).getMLStatistics.useQuery(undefined);
  const { data: modelData, refetch: refetchModels } = (trpc.antiBan as any).getModelPerformance.useQuery(undefined);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(async () => {
      try {
        await Promise.all([
          refetchML(),
          refetchModels(),
        ]);
      } catch (error) {
        console.error('Auto refresh failed:', error);
      }
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, refetchML, refetchModels]);

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 95) return '#10b981';
    if (accuracy >= 85) return '#f59e0b';
    return '#ef4444';
  };

  const getModelStatus = (model: any) => {
    if (model?.trained && model?.accuracy >= 90) return { text: 'ممتاز', color: '#10b981' };
    if (model?.trained && model?.accuracy >= 80) return { text: 'جيد', color: '#f59e0b' };
    if (model?.trained) return { text: 'ضعيف', color: '#ef4444' };
    return { text: 'غير مدرب', color: '#6b7280' };
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🧠 لوحة تحكم التعلم الآلي</Text>
        <TouchableOpacity
          style={[styles.controlButton, autoRefresh && styles.controlButtonActive]}
          onPress={() => setAutoRefresh(!autoRefresh)}
        >
          <Text style={styles.controlButtonText}>
            {autoRefresh ? '⏸' : '▶️'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.modelSelector}>
        {['all', 'pattern', 'anomaly', 'predictive'].map((model) => (
          <TouchableOpacity
            key={model}
            style={[
              styles.modelTab,
              selectedModel === model && styles.modelTabActive
            ]}
            onPress={() => setSelectedModel(model)}
          >
            <Text style={[
              styles.modelTabText,
              selectedModel === model && styles.modelTabTextActive
            ]}>
              {model === 'all' ? 'الكل' :
                model === 'pattern' ? 'الأنماط' :
                  model === 'anomaly' ? 'الشذوذ' : 'التنبؤ'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.overviewGrid}>
        <View style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>📊 إحصائيات التعلم</Text>
          <View style={styles.overviewStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{mlStats?.totalTrainingSamples || 0}</Text>
              <Text style={styles.statLabel}>عينة تدريب</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{mlStats?.trainedModels || 0}</Text>
              <Text style={styles.statLabel}>نموذج مدرب</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{mlStats?.averageAccuracy ? (mlStats.averageAccuracy * 100).toFixed(1) : 0}%</Text>
              <Text style={styles.statLabel}>متوسط الدقة</Text>
            </View>
          </View>
        </View>

        <View style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>🎯 أداء التنبؤ</Text>
          <View style={styles.performanceMetrics}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>دقة التنبؤ:</Text>
              <Text style={[styles.metricValue, { color: getAccuracyColor(mlStats?.predictionAccuracy * 100 || 0) }]}>
                {mlStats?.predictionAccuracy ? (mlStats.predictionAccuracy * 100).toFixed(1) : 0}%
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>التنبؤات اليوم:</Text>
              <Text style={styles.metricValue}>{mlStats?.dailyPredictions || 0}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>معدل الخطأ:</Text>
              <Text style={styles.metricValue}>{mlStats?.errorRate ? (mlStats.errorRate * 100).toFixed(1) : 0}%</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.modelsSection}>
        <Text style={styles.sectionTitle}>🤖 النماذج المدربة</Text>
        <View style={styles.modelsList}>
          {[
            { id: 'pattern', name: 'التعرف على الأنماط', type: 'Neural Network' },
            { id: 'anomaly', name: 'كشف الشذوذ', type: 'Isolation Forest' },
            { id: 'predictive', name: 'التنبؤ', type: 'Gradient Boosting' }
          ].map((modelItem) => {
            const currentModelData = modelData?.[modelItem.id];
            const status = getModelStatus(currentModelData);

            return (
              <View key={modelItem.id} style={styles.modelCard}>
                <View style={styles.modelHeader}>
                  <View>
                    <Text style={styles.modelName}>{modelItem.name}</Text>
                    <Text style={styles.modelType}>{modelItem.type}</Text>
                  </View>
                  <View style={[styles.modelStatus, { backgroundColor: status.color }]}>
                    <Text style={styles.modelStatusText}>{status.text}</Text>
                  </View>
                </View>

                <View style={styles.modelMetrics}>
                  <View style={styles.modelMetric}>
                    <Text style={styles.modelMetricLabel}>الدقة:</Text>
                    <Text style={[styles.modelMetricValue, { color: getAccuracyColor(currentModelData?.accuracy * 100 || 0) }]}>
                      {currentModelData?.accuracy ? (currentModelData.accuracy * 100).toFixed(1) : 0}%
                    </Text>
                  </View>
                  <View style={styles.modelMetric}>
                    <Text style={styles.modelMetricLabel}>العينات:</Text>
                    <Text style={styles.modelMetricValue}>{currentModelData?.trainingSamples || 0}</Text>
                  </View>
                  <View style={styles.modelMetric}>
                    <Text style={styles.modelMetricLabel}>آخر تحديث:</Text>
                    <Text style={styles.modelMetricValue}>
                      {currentModelData?.lastTrained ? new Date(currentModelData.lastTrained).toLocaleTimeString() : 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.trainingSection}>
        <Text style={styles.sectionTitle}>🎓 التدريب التلقائي</Text>
        <View style={styles.trainingCard}>
          <View style={styles.trainingStatus}>
            <View style={[styles.trainingIndicator, { backgroundColor: '#10b981' }]} />
            <Text style={styles.trainingStatusText}>نشط</Text>
          </View>
          <Text style={styles.trainingDesc}>
            يتم تدريب النماذج تلقائياً كل 50 عملية جديدة
          </Text>

          <View style={styles.trainingMetrics}>
            <View style={styles.trainingMetric}>
              <Text style={styles.trainingMetricLabel}>العمليات منذ آخر تدريب:</Text>
              <Text style={styles.trainingMetricValue}>{mlStats?.operationsSinceLastTraining || 0}</Text>
            </View>
            <View style={styles.trainingMetric}>
              <Text style={styles.trainingMetricLabel}>التدريب التالي بعد:</Text>
              <Text style={styles.trainingMetricValue}>
                {Math.max(0, 50 - (mlStats?.operationsSinceLastTraining || 0))} عملية
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.anomaliesSection}>
        <Text style={styles.sectionTitle}>🔍 كشف الشذوذ</Text>
        <View style={styles.anomaliesCard}>
          <View style={styles.anomalyStats}>
            <View style={styles.anomalyStat}>
              <Text style={styles.anomalyStatNumber}>{mlStats?.anomaliesDetected || 0}</Text>
              <Text style={styles.anomalyStatLabel}>شذوذ تم كشفه</Text>
            </View>
            <View style={styles.anomalyStat}>
              <Text style={styles.anomalyStatNumber}>{mlStats?.falsePositives || 0}</Text>
              <Text style={styles.anomalyStatLabel}>إيجابيات كاذبة</Text>
            </View>
            <View style={styles.anomalyStat}>
              <Text style={styles.anomalyStatNumber}>{mlStats?.anomalyAccuracy ? (mlStats.anomalyAccuracy * 100).toFixed(1) : 0}%</Text>
              <Text style={styles.anomalyStatLabel}>دقة الكشف</Text>
            </View>
          </View>

          <View style={styles.recentAnomalies}>
            <Text style={styles.recentAnomaliesTitle}>الشذوذ الحديث</Text>
            <View style={styles.anomalyList}>
              <View style={styles.anomalyItem}>
                <Text style={styles.anomalyType}>ارتفاع معدل الخطأ</Text>
                <Text style={styles.anomalyTime}>منذ 10 دقائق</Text>
              </View>
              <View style={styles.anomalyItem}>
                <Text style={styles.anomalyType}>تأخير غير طبيعي</Text>
                <Text style={styles.anomalyTime}>منذ 25 دقيقة</Text>
              </View>
              <View style={styles.anomalyItem}>
                <Text style={styles.anomalyType}>نمط غير معروف</Text>
                <Text style={styles.anomalyTime}>منذ 1 ساعة</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.patternsSection}>
        <Text style={styles.sectionTitle}>📈 التعرف على الأنماط</Text>
        <View style={styles.patternsCard}>
          <View style={styles.patternStats}>
            <View style={styles.patternStat}>
              <Text style={styles.patternStatNumber}>{mlStats?.patternsRecognized || 0}</Text>
              <Text style={styles.patternStatLabel}>نمط تم التعرف عليه</Text>
            </View>
            <View style={styles.patternStat}>
              <Text style={styles.patternStatNumber}>{mlStats?.patternAccuracy ? (mlStats.patternAccuracy * 100).toFixed(1) : 0}%</Text>
              <Text style={styles.patternStatLabel}>دقة التعرف</Text>
            </View>
          </View>

          <View style={styles.patternTypes}>
            <Text style={styles.patternTypesTitle}>أنواع الأنماط المكتشفة</Text>
            <View style={styles.patternList}>
              <View style={styles.patternItem}>
                <Text style={styles.patternName}>العمليات المتتالية</Text>
                <Text style={styles.patternCount}>{mlStats?.sequentialPatternCount || 0}</Text>
              </View>
              <View style={styles.patternItem}>
                <Text style={styles.patternName}>الأنماط الزمنية</Text>
                <Text style={styles.patternCount}>{mlStats?.temporalPatternCount || 0}</Text>
              </View>
              <View style={styles.patternItem}>
                <Text style={styles.patternName}>أنماط الأخطاء</Text>
                <Text style={styles.patternCount}>{mlStats?.errorPatternCount || 0}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  controlButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  controlButtonActive: {
    backgroundColor: '#3b82f6',
  },
  controlButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
  modelSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modelTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    marginHorizontal: 4,
  },
  modelTabActive: {
    backgroundColor: '#3b82f6',
  },
  modelTabText: {
    fontSize: 14,
    color: '#6b7280',
  },
  modelTabTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  overviewGrid: {
    flexDirection: 'column',
    gap: 16,
    padding: 16,
  },
  overviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overviewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  performanceMetrics: {
    gap: 8,
  },
  metric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  modelsSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  modelsList: {
    gap: 12,
  },
  modelCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modelType: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  modelStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modelStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  modelMetrics: {
    gap: 8,
  },
  modelMetric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelMetricLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  modelMetricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  trainingSection: {
    marginTop: 16,
  },
  trainingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trainingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  trainingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  trainingStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  trainingDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
  },
  trainingMetrics: {
    gap: 8,
  },
  trainingMetric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trainingMetricLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  trainingMetricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  anomaliesSection: {
    marginTop: 16,
  },
  anomaliesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  anomalyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  anomalyStat: {
    alignItems: 'center',
  },
  anomalyStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  anomalyStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  recentAnomalies: {
    gap: 12,
  },
  recentAnomaliesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  anomalyList: {
    gap: 8,
  },
  anomalyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  anomalyType: {
    fontSize: 14,
    color: '#1f2937',
  },
  anomalyTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  patternsSection: {
    marginTop: 16,
  },
  patternsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  patternStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  patternStat: {
    alignItems: 'center',
  },
  patternStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  patternStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  patternTypes: {
    gap: 12,
  },
  patternTypesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  patternList: {
    gap: 8,
  },
  patternItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  patternName: {
    fontSize: 14,
    color: '#1f2937',
  },
  patternCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
});
