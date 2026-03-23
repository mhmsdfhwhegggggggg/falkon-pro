import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { trpc } from '@/lib/trpc';
import { getHardwareId } from '@/lib/hwid';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useColors } from '@/hooks/use-colors';

export default function LicenseActivationScreen() {
  const [licenseKey, setLicenseKey] = useState('');
  const [hwid, setHwid] = useState('');
  const [loading, setLoading] = useState(false);

  const activateMutation = trpc.license.activateLicense.useMutation();

  const colors = useColors();

  useEffect(() => {
    getHardwareId().then(setHwid);
  }, []);

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(hwid);
    Alert.alert('تم النسخ', 'تم نسخ معرف الجهاز إلى الحافظة');
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال مفتاح الترخيص');
      return;
    }

    setLoading(true);
    try {
      const result = await activateMutation.mutateAsync({
        licenseKey: licenseKey.trim(),
        hardwareId: hwid,
      });

      if (result.success) {
        Alert.alert('تم التفعيل', 'تم تفعيل البرنامج بنجاح على هذا الجهاز');
        router.replace('/(tabs)');
      } else {
        Alert.alert('فشل التفعيل', result.message || 'المفتاح غير صالح أو مرتبط بجهاز آخر');
      }
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'حدث خطأ أثناء التفعيل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>تفعيل التنين برو 🐉</Text>
        <Text style={styles.subtitle}>يرجى إدخال مفتاح الترخيص الخاص بك للمتابعة</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>مفتاح الترخيص</Text>
          <TextInput
            style={styles.input}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            placeholderTextColor="#666"
            value={licenseKey}
            onChangeText={setLicenseKey}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.infoContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <TouchableOpacity onPress={copyToClipboard} style={styles.copyBadge}>
                <Text style={styles.copyBadgeText}>نسخ ID الجهاز</Text>
              </TouchableOpacity>
              <Text style={styles.infoLabel}>معرف الجهاز (HWID):</Text>
            </View>
            <Text style={styles.hwidText} numberOfLines={1}>{hwid || 'جاري التحميل...'}</Text>
        </View>

        <View style={styles.supportHint}>
          <Text style={styles.supportText}>هل تواجه مشكلة؟ تواصل مع الدعم الفني</Text>
          <Text style={styles.supportLink}>@falkon_support_bot</Text>
        </View>

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleActivate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>تفعيل الآن</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerText}>
          الترخيص مرتبط بهذا الجهاز فقط ولا يمكن نقله.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    padding: 32,
    borderRadius: 24,
    backgroundColor: 'rgba(20, 20, 20, 0.8)',
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  infoContainer: {
    marginBottom: 32,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  infoLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'right',
  },
  hwidText: {
    color: '#888',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  footerText: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
  copyBadge: {
    backgroundColor: '#007AFF20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF40',
  },
  copyBadgeText: {
    color: '#007AFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  supportHint: {
    marginTop: 24,
    marginBottom: 24,
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 16,
    backgroundColor: '#0a0a0a',
  },
  supportText: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  supportLink: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: 'bold',
  }
});
