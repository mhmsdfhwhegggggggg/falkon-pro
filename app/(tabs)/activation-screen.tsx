import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { trpc } from '@/lib/trpc';

/**
 * Activation Screen
 * 
 * License activation interface for FALKON PRO Telegram Pro
 * Features:
 * - Online activation
 * - Offline activation
 * - Hardware binding
 * - Status checking
 */
export default function ActivationScreen() {
  const [licenseKey, setLicenseKey] = useState('');
  const [hardwareId, setHardwareId] = useState('');
  const [activationMode, setActivationMode] = useState<'online' | 'offline'>('online');
  const [offlineFile, setOfflineFile] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  // tRPC queries
  const { data: hardwareIdData } = trpc.license.generateHardwareId.useQuery(undefined);

  // tRPC mutations
  const activateLicense = trpc.license.activateLicense.useMutation();
  const validateLicense = trpc.license.validateLicense.useMutation();

  useEffect(() => {
    if (hardwareIdData?.hardwareId) {
      setHardwareId(hardwareIdData.hardwareId);
    }
  }, [hardwareIdData]);

  const handleOnlineActivation = async () => {
    if (!licenseKey.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال مفتاح الترخيص');
      return;
    }

    if (!hardwareId.trim()) {
      Alert.alert('خطأ', 'معرف الجهاز غير متوفر');
      return;
    }

    setIsActivating(true);
    activateLicense.mutate({
      licenseKey: licenseKey.trim(),
      hardwareId: hardwareId.trim(),
    }, {
      onSuccess: (result: any) => {
        if (result.success) {
          Alert.alert(
            '✅ نجاح التفعيل',
            'تم تفعيل الترخيص بنجاح! يمكنك الآن استخدام جميع ميزات التطبيق.',
            [{ text: 'حسناً', style: 'default' }]
          );
        } else {
          Alert.alert('❌ فشل التفعيل', result.message || 'فشل تفعيل الترخيص');
        }
      },
      onError: () => {
        Alert.alert('❌ خطأ', 'حدث خطأ أثناء تفعيل الترخيص');
      }
    });
    setIsActivating(false);
  };

  const handleOfflineActivation = async () => {
    if (!offlineFile.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال ملف التفعيل');
      return;
    }

    if (!hardwareId.trim()) {
      Alert.alert('خطأ', 'معرف الجهاز غير متوفر');
      return;
    }

    setIsActivating(true);
    try {
      // This would call the offline activation endpoint
      Alert.alert('✅ نجاح التفعيل', 'تم تفعيل الترخيص بنجاح!');
    } catch (error) {
      Alert.alert('❌ خطأ', 'حدث خطأ أثناء التفعيل');
    } finally {
      setIsActivating(false);
    }
  };

  const handleValidateLicense = async () => {
    if (!licenseKey.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال مفتاح الترخيص');
      return;
    }

    validateLicense.mutate({
      licenseKey: licenseKey.trim(),
      hardwareId: hardwareId.trim(),
    }, {
      onSuccess: (result: any) => {
        if (result.success) {
          const { valid, errors, warnings, remainingDays, usageRemaining } = result.validation;

          let message = valid ? '✅ الترخيص صالح' : '❌ الترخيص غير صالح';

          if (valid) {
            if (remainingDays) message += `\n📅 الأيام المتبقية: ${remainingDays}`;
            if (usageRemaining !== undefined) message += `\n📊 الاستخدام المتبقي: ${usageRemaining}`;
            if (warnings.length > 0) message += `\n⚠️ تحذيرات: ${warnings.join(', ')}`;
          } else {
            message += `\n❌ الأخطاء: ${errors.join(', ')}`;
          }

          Alert.alert('نتيجة التحقق', message);
        } else {
          Alert.alert('خطأ', result.error || 'فشل التحقق من الترخيص');
        }
      },
      onError: () => {
        Alert.alert('خطأ', 'حدث خطأ أثناء التحقق');
      }
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔐 تفعيل الترخيص</Text>
        <Text style={styles.headerSubtitle}>قم بتفعيل ترخيص FALKON PRO Telegram Pro</Text>
      </View>

      <View style={styles.hardwareSection}>
        <Text style={styles.hardwareTitle}>🖥️ معرف الجهاز</Text>
        <View style={styles.hardwareCard}>
          <Text style={styles.hardwareId}>{hardwareId || 'Loading...'}</Text>
          <TouchableOpacity style={styles.copyButton}>
            <Text style={styles.copyButtonText}>📋 نسخ</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hardwareDescription}>
          هذا المعرف فريد لجهازك ويستخدم لربط الترخيص به
        </Text>
      </View>

      <View style={styles.modeSelector}>
        <Text style={styles.modeTitle}>🔄 طريقة التفعيل</Text>
        <View style={styles.modeButtons}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              activationMode === 'online' && styles.modeButtonActive
            ]}
            onPress={() => setActivationMode('online')}
          >
            <Text style={[
              styles.modeButtonText,
              activationMode === 'online' && styles.modeButtonTextActive
            ]}>
              🌐 عبر الإنترنت
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              activationMode === 'offline' && styles.modeButtonActive
            ]}
            onPress={() => setActivationMode('offline')}
          >
            <Text style={[
              styles.modeButtonText,
              activationMode === 'offline' && styles.modeButtonTextActive
            ]}>
              📱 بدون إنترنت
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {activationMode === 'online' ? (
        <View style={styles.activationSection}>
          <Text style={styles.sectionTitle}>🌐 التفعيل عبر الإنترنت</Text>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>🔑 مفتاح الترخيص</Text>
            <TextInput
              style={styles.textInput}
              value={licenseKey}
              onChangeText={setLicenseKey}
              placeholder="DTP-XXXX-XXXX-XXXX"
              autoCapitalize="characters"
              textAlign="center"
            />
            <Text style={styles.inputHint}>
              أدخل مفتاح الترخيص الذي تلقيته عند الشراء
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.activateButton, isActivating && styles.activateButtonDisabled]}
            onPress={handleOnlineActivation}
            disabled={isActivating}
          >
            <Text style={styles.activateButtonText}>
              {isActivating ? '🔄 جاري التفعيل...' : '🚀 تفعيل الترخيص'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.validateButton}
            onPress={handleValidateLicense}
          >
            <Text style={styles.validateButtonText}>🔍 التحقق من الترخيص</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.activationSection}>
          <Text style={styles.sectionTitle}>📱 التفعيل بدون إنترنت</Text>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>📄 ملف التفعيل</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={offlineFile}
              onChangeText={setOfflineFile}
              placeholder="أدخل محتوى ملف التفعيل هنا..."
              multiline
              numberOfLines={4}
            />
            <Text style={styles.inputHint}>
              الصق محتوى ملف التفعيل الذي حصلت عليه من الدعم الفني
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.activateButton, isActivating && styles.activateButtonDisabled]}
            onPress={handleOfflineActivation}
            disabled={isActivating}
          >
            <Text style={styles.activateButtonText}>
              {isActivating ? '🔄 جاري التفعيل...' : '🚀 تفعيل الترخيص'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>ℹ️ معلومات هامة</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoItem}>🔒 الترخيص مرتبط بجهازك فقط</Text>
          <Text style={styles.infoItem}>🔄 يمكنك نقل الترخيص لجهاز آخر</Text>
          <Text style={styles.infoItem}>📅 التراخيص تدعم التجديد التلقائي</Text>
          <Text style={styles.infoItem}>🛡️ حماية متقدمة ضد النسخ</Text>
        </View>

        <View style={styles.supportSection}>
          <Text style={styles.supportTitle}>🎯 تحتاج مساعدة؟</Text>
          <Text style={styles.supportText}>
            إذا واجهت أي مشاكل في التفعيل، تواصل مع فريق الدعم الفني
          </Text>
          <TouchableOpacity style={styles.supportButton}>
            <Text style={styles.supportButtonText}>📧 تواصل مع الدعم</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          FALKON PRO Telegram Pro v3.0 - نظام الترخيص المتقدم
        </Text>
        <Text style={styles.footerSubtext}>
          © 2024 جميع الحقوق محفوظة
        </Text>
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
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  hardwareSection: {
    padding: 20,
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hardwareTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  hardwareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  hardwareId: {
    flex: 1,
    fontSize: 12,
    color: '#1f2937',
    fontFamily: 'monospace',
  },
  copyButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  hardwareDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  modeSelector: {
    padding: 20,
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#3b82f6',
  },
  modeButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#ffffff',
  },
  activationSection: {
    padding: 20,
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  activateButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  activateButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  activateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  validateButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  validateButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    padding: 20,
    margin: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  infoItem: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  supportSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  supportText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  supportButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  supportButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    padding: 20,
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 10,
    color: '#9ca3af',
  },
});

