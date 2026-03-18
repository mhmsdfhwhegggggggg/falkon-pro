import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { trpc } from '@/lib/trpc';

const trpcAny = trpc as any;

/**
 * License Management Dashboard
 * 
 * Complete license and subscription management interface
 * Features:
 * - License generation and validation
 * - Subscription management
 * - Usage tracking
 * - Analytics and reporting
 * - Hardware binding
 */
export default function LicenseDashboardScreen() {
  const [activeTab, setActiveTab] = useState<'overview' | 'licenses' | 'subscriptions' | 'analytics'>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [newLicenseForm, setNewLicenseForm] = useState({
    userId: '',
    type: 'basic',
    durationDays: '30',
    maxAccounts: '1',
    maxMessages: '1000',
    autoRenew: false,
  });

  // tRPC queries
  const { data: analytics, refetch: refetchAnalytics } = trpcAny.license.getAnalytics.useQuery(undefined);
  const { data: userLicenses, refetch: refetchLicenses } = trpcAny.license.getUserLicenses.useQuery(undefined);
  const { data: hardwareId } = trpcAny.license.generateHardwareId.useQuery(undefined);

  // tRPC mutations
  const generateLicense = trpcAny.license.generateLicense.useMutation();
  const validateLicense = trpcAny.license.validateLicense.useMutation();
  const activateLicense = trpcAny.license.activateLicense.useMutation();
  const createSubscription = trpcAny.license.createSubscription.useMutation();
  const renewSubscription = trpcAny.license.renewSubscription.useMutation();
  const cancelSubscription = trpcAny.license.cancelSubscription.useMutation();

  const refreshData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchAnalytics(),
        refetchLicenses(),
      ]);
    } catch (error) {
      Alert.alert('خطأ', 'فشل تحديث البيانات');
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateLicense = () => {
    generateLicense.mutate({
      userId: parseInt(newLicenseForm.userId),
      type: newLicenseForm.type as any,
      durationDays: parseInt(newLicenseForm.durationDays),
      maxAccounts: parseInt(newLicenseForm.maxAccounts),
      maxMessages: parseInt(newLicenseForm.maxMessages),
      autoRenew: newLicenseForm.autoRenew,
    }, {
      onSuccess: (result: any) => {
        if (result.success) {
          Alert.alert('نجاح', `تم إنشاء الترخيص بنجاح: ${result.licenseKey}`);
          setNewLicenseForm({
            userId: '',
            type: 'basic',
            durationDays: '30',
            maxAccounts: '1',
            maxMessages: '1000',
            autoRenew: false,
          });
          refreshData();
        } else {
          Alert.alert('خطأ', result.error || 'فشل إنشاء الترخيص');
        }
      },
      onError: () => {
        Alert.alert('خطأ', 'حدث خطأ أثناء إنشاء الترخيص');
      }
    });
  };

  const handleValidateLicense = (licenseKey: string) => {
    validateLicense.mutate({
      licenseKey,
      hardwareId: hardwareId?.hardwareId,
    }, {
      onSuccess: (result: any) => {
        if (result.success) {
          const { valid, errors, warnings, remainingDays, usageRemaining } = result.validation;

          if (valid) {
            let message = 'الترخيص صالح ✅';
            if (remainingDays) message += `\nالأيام المتبقية: ${remainingDays}`;
            if (usageRemaining !== undefined) message += `\nالاستخدام المتبقي: ${usageRemaining}`;
            if (warnings.length > 0) message += `\nتحذيرات: ${warnings.join(', ')}`;

            Alert.alert('نجاح', message);
          } else {
            Alert.alert('خطأ', `الترخيص غير صالح: ${errors.join(', ')}`);
          }
        } else {
          Alert.alert('خطأ', result.error || 'فشل التحقق من الترخيص');
        }
      },
      onError: () => {
        Alert.alert('خطأ', 'حدث خطأ أثناء التحقق من الترخيص');
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'inactive': return '#6b7280';
      case 'expired': return '#ef4444';
      case 'suspended': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'نشط';
      case 'inactive': return 'غير نشط';
      case 'expired': return 'منتهي';
      case 'suspended': return 'معلق';
      default: return status;
    }
  };

  const renderOverview = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📊 نظرة عامة</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{analytics?.analytics?.totalLicenses || 0}</Text>
          <Text style={styles.statLabel}>إجمالي التراخيص</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{analytics?.analytics?.activeLicenses || 0}</Text>
          <Text style={styles.statLabel}>التراخيص النشطة</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>${analytics?.analytics?.totalRevenue || 0}</Text>
          <Text style={styles.statLabel}>إجمالي الإيرادات</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{analytics?.analytics?.expiringSoon || 0}</Text>
          <Text style={styles.statLabel}>تنتهي قريباً</Text>
        </View>
      </View>

      <View style={styles.hardwareSection}>
        <Text style={styles.hardwareTitle}>🔐 معرف الجهاز</Text>
        <Text style={styles.hardwareId}>{hardwareId?.hardwareId || 'Loading...'}</Text>
        <TouchableOpacity style={styles.copyButton} onPress={() => {
          if (hardwareId?.hardwareId) {
            Alert.alert('تم النسخ', 'تم نسخ معرف الجهاز');
          }
        }}>
          <Text style={styles.copyButtonText}>نسخ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLicenses = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📜 إدارة التراخيص</Text>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>إنشاء ترخيص جديد</Text>

        <View style={styles.formRow}>
          <Text style={styles.formLabel}>معرف المستخدم:</Text>
          <TextInput
            style={styles.textInput}
            value={newLicenseForm.userId}
            onChangeText={(text) => setNewLicenseForm({ ...newLicenseForm, userId: text })}
            placeholder="أدخل معرف المستخدم"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.formRow}>
          <Text style={styles.formLabel}>نوع الترخيص:</Text>
          <View style={styles.typeSelector}>
            {['trial', 'basic', 'premium', 'enterprise'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  newLicenseForm.type === type && styles.typeButtonActive
                ]}
                onPress={() => setNewLicenseForm({ ...newLicenseForm, type })}
              >
                <Text style={[
                  styles.typeButtonText,
                  newLicenseForm.type === type && styles.typeButtonTextActive
                ]}>
                  {type === 'trial' ? 'تجريبي' :
                    type === 'basic' ? 'أساسي' :
                      type === 'premium' ? 'مميز' : 'مؤسسي'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formRow}>
          <Text style={styles.formLabel}>مدة (أيام):</Text>
          <TextInput
            style={styles.textInput}
            value={newLicenseForm.durationDays}
            onChangeText={(text) => setNewLicenseForm({ ...newLicenseForm, durationDays: text })}
            placeholder="30"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.formRow}>
          <Text style={styles.formLabel}>أقصى عدد حسابات:</Text>
          <TextInput
            style={styles.textInput}
            value={newLicenseForm.maxAccounts}
            onChangeText={(text) => setNewLicenseForm({ ...newLicenseForm, maxAccounts: text })}
            placeholder="1"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.formRow}>
          <Text style={styles.formLabel}>أقصى عدد رسائل:</Text>
          <TextInput
            style={styles.textInput}
            value={newLicenseForm.maxMessages}
            onChangeText={(text) => setNewLicenseForm({ ...newLicenseForm, maxMessages: text })}
            placeholder="1000"
            keyboardType="numeric"
          />
        </View>

        <TouchableOpacity style={styles.generateButton} onPress={handleGenerateLicense}>
          <Text style={styles.generateButtonText}>إنشاء ترخيص</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.licenseList}>
        <Text style={styles.listTitle}>التراخيص الحالية</Text>
        {userLicenses?.licenses?.map((license: any) => (
          <View key={license.id} style={styles.licenseCard}>
            <View style={styles.licenseHeader}>
              <Text style={styles.licenseKey}>{license.licenseKey}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(license.status) }]}>
                <Text style={styles.statusText}>{getStatusText(license.status)}</Text>
              </View>
            </View>

            <View style={styles.licenseDetails}>
              <Text style={styles.licenseDetail}>النوع: {license.type}</Text>
              <Text style={styles.licenseDetail}>الحسابات: {license.maxAccounts}</Text>
              <Text style={styles.licenseDetail}>الرسائل: {license.maxMessages}</Text>
              <Text style={styles.licenseDetail}>الاستخدام: {license.usageCount}</Text>
              {license.expiresAt && (
                <Text style={styles.licenseDetail}>
                  ينتهي: {new Date(license.expiresAt).toLocaleDateString()}
                </Text>
              )}
            </View>

            <View style={styles.licenseActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleValidateLicense(license.licenseKey)}
              >
                <Text style={styles.actionButtonText}>تحقق</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  if (hardwareId?.hardwareId) {
                    activateLicense.mutate({
                      licenseKey: license.licenseKey,
                      hardwareId: hardwareId.hardwareId,
                    });
                  }
                }}
              >
                <Text style={styles.actionButtonText}>تفعيل</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderSubscriptions = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>💳 إدارة الاشتراكات</Text>

      <View style={styles.subscriptionPlans}>
        <Text style={styles.plansTitle}>خطط الاشتراك</Text>

        {[
          { name: 'شهري', price: 29, duration: '30 يوم' },
          { name: 'ربع سنوي', price: 79, duration: '90 يوم' },
          { name: 'سنوي', price: 299, duration: '365 يوم' },
          { name: 'مدى الحياة', price: 999, duration: 'مدى الحياة' },
        ].map((plan, index) => (
          <View key={index} style={styles.planCard}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>${plan.price}</Text>
            </View>
            <Text style={styles.planDuration}>{plan.duration}</Text>
            <TouchableOpacity style={styles.subscribeButton}>
              <Text style={styles.subscribeButtonText}>اشترك الآن</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );

  const renderAnalytics = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📈 التحليلات والتقارير</Text>

      <View style={styles.analyticsGrid}>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsTitle}>توزيع الخطط</Text>
          {Object.entries(analytics?.analytics?.planDistribution || {}).map(([plan, count]) => (
            <View key={plan} style={styles.analyticsRow}>
              <Text style={styles.analyticsLabel}>{plan}</Text>
              <Text style={styles.analyticsValue}>{String(count)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsTitle}>الإيرادات</Text>
          <View style={styles.analyticsRow}>
            <Text style={styles.analyticsLabel}>الإجمالي:</Text>
            <Text style={styles.analyticsValue}>${analytics?.analytics?.totalRevenue || 0}</Text>
          </View>
          <View style={styles.analyticsRow}>
            <Text style={styles.analyticsLabel}>شهري:</Text>
            <Text style={styles.analyticsValue}>${analytics?.analytics?.monthlyRevenue || 0}</Text>
          </View>
        </View>

        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsTitle}>حالة التراخيص</Text>
          <View style={styles.analyticsRow}>
            <Text style={styles.analyticsLabel}>نشط:</Text>
            <Text style={styles.analyticsValue}>{analytics?.analytics?.activeLicenses || 0}</Text>
          </View>
          <View style={styles.analyticsRow}>
            <Text style={styles.analyticsLabel}>منتهي:</Text>
            <Text style={styles.analyticsValue}>{analytics?.analytics?.expiredLicenses || 0}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔐 إدارة التراخيص</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={refreshData}>
          <Text style={styles.refreshButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabSelector}>
        {[
          { key: 'overview', label: 'نظرة عامة' },
          { key: 'licenses', label: 'التراخيص' },
          { key: 'subscriptions', label: 'الاشتراكات' },
          { key: 'analytics', label: 'التحليلات' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              activeTab === tab.key && styles.tabButtonActive
            ]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text style={[
              styles.tabButtonText,
              activeTab === tab.key && styles.tabButtonTextActive
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'licenses' && renderLicenses()}
      {activeTab === 'subscriptions' && renderSubscriptions()}
      {activeTab === 'analytics' && renderAnalytics()}
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
  refreshButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  refreshButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    marginHorizontal: 4,
  },
  tabButtonActive: {
    backgroundColor: '#3b82f6',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#6b7280',
  },
  tabButtonTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  hardwareSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hardwareTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  hardwareId: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  copyButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  copyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  formRow: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1f2937',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#3b82f6',
  },
  typeButtonText: {
    fontSize: 12,
    color: '#6b7280',
  },
  typeButtonTextActive: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  generateButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  licenseList: {
    gap: 12,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  licenseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  licenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  licenseKey: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  licenseDetails: {
    gap: 4,
    marginBottom: 12,
  },
  licenseDetail: {
    fontSize: 12,
    color: '#6b7280',
  },
  licenseActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  subscriptionPlans: {
    gap: 12,
  },
  plansTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10b981',
  },
  planDuration: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  subscribeButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  analyticsGrid: {
    gap: 12,
  },
  analyticsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  analyticsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  analyticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  analyticsLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  analyticsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
});
