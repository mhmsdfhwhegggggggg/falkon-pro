import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Image,
} from 'react-native';
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { GlassCard } from "@/components/ui/glass-card";
import { trpc } from '@/lib/trpc';
import { IconSymbol } from "@/components/ui/icon-symbol";
import { localSessionStore } from '@/lib/local-session-store';

const trpcAny = trpc as any;

/**
 * Extract & Add Screen - ULTIMATE INDUSTRIAL EDITION
 * 
 * Built for 24/7 operation, zero crashes, maximum performance.
 * This is the heart of the system where extraction and addition are merged.
 */
export default function ExtractAndAddScreen() {
  const colors = useColors();

  // Form state
  const [accountId, setAccountId] = useState<number | null>(null);
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [extractMode, setExtractMode] = useState<'all' | 'engaged' | 'admins'>('all');
  const [daysActive, setDaysActive] = useState('7');
  const [excludeBots, setExcludeBots] = useState(true);
  const [requireUsername, setRequireUsername] = useState(true);
  const [limit, setLimit] = useState('1000');
  const [delayMs, setDelayMs] = useState('2000');

  // Job state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'queued' | 'running' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);

  // tRPC
  const { data: accounts, isLoading: loadingAccounts } = (trpcAny.accounts.getAll.useQuery(undefined) as any);
  const startOperationMutation = trpcAny.bulkOps.startExtractAndAdd.useMutation();

  const jobStatusQuery = trpc.bulkOps.getJobStatus.useQuery(
    { jobId: currentJobId || "" },
    { enabled: !!currentJobId, refetchInterval: 2000 }
  );

  useEffect(() => {
    if (jobStatusQuery.data?.found) {
      setStatus(jobStatusQuery.data.status as any);
      setProgress(jobStatusQuery.data.progress);
      if (jobStatusQuery.data.status === 'completed') {
        setResult(jobStatusQuery.data.result);
      }
    }
  }, [jobStatusQuery.data]);

  const handleStart = async () => {
    if (!accountId) return Alert.alert("تنبيه", "يرجى اختيار حساب أولاً");
    if (!source || !target) return Alert.alert("تنبيه", "يرجى إدخال المصدر والهدف");

    const sessionString = await localSessionStore.getAccountSession(accountId);

    startOperationMutation.mutate({
      accountId,
      source,
      target,
      extractMode,
      daysActive: extractMode === 'engaged' ? Number(daysActive) : undefined,
      excludeBots,
      requireUsername,
      limit: limit ? Number(limit) : undefined,
      delayMs: Number(delayMs),
      sessionString,
    }, {
      onSuccess: (data: any) => {
        setCurrentJobId(data.jobId);
        setStatus('queued');
        Alert.alert("نجاح", `تم بد عملية الاستخراج والإضافة (ID: ${data.jobId})`);
      },
      onError: (error: any) => {
        Alert.alert("خطأ", error.message || "فشل بدء العملية");
      }
    });
  };

  const isRunning = currentJobId && (status === 'running' || status === 'queued');

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-6 gap-6">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-3xl font-bold text-foreground">الاستخراج + الإضافة</Text>
              <Text className="text-sm text-muted mt-1">العملية المتكاملة 24/7</Text>
            </View>
            <View className="w-12 h-12 rounded-2xl bg-primary/10 items-center justify-center">
              <IconSymbol name="arrow.up.arrow.down" size={24} color={colors.primary} />
            </View>
          </View>

          {/* Presets */}
          <View className="flex-row gap-2">
            {['توربو', 'خفي', 'وحش'].map((preset, i) => (
              <TouchableOpacity
                key={i}
                className="flex-1 bg-surface border border-border py-3 rounded-xl items-center"
                onPress={() => {
                  if (preset === 'توربو') { setDelayMs('500'); setLimit('5000'); }
                  if (preset === 'خفي') { setDelayMs('5000'); setLimit('200'); }
                  if (preset === 'وحش') { setDelayMs('1500'); setLimit('10000'); }
                }}
              >
                <Text className="text-xs font-bold text-foreground">{preset}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Account Selection */}
          <GlassCard delay={100} className="p-4 gap-3">
            <Text className="text-sm font-semibold text-foreground">حساب التنفيذ</Text>
            {loadingAccounts ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                {accounts?.map((account: any) => (
                  <TouchableOpacity
                    key={account.id}
                    onPress={() => setAccountId(account.id)}
                    className={`px-4 py-2 rounded-xl border ${accountId === account.id ? 'border-primary bg-primary/20' : 'border-border bg-background/50'}`}
                  >
                    <Text style={{ color: accountId === account.id ? colors.primary : colors.foreground, fontWeight: accountId === account.id ? 'bold' : 'normal' }}>
                      {account.phoneNumber}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </GlassCard>

          {/* Source & Target */}
          <GlassCard delay={200} className="p-4 gap-4">
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">المصدر (استخراج من)</Text>
              <TextInput
                placeholder="رابط الجروب أو @username"
                value={source}
                onChangeText={setSource}
                className="bg-background/80 border border-border rounded-xl p-3 text-foreground"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
              />
            </View>
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">الهدف (إضافة إلى)</Text>
              <TextInput
                placeholder="رابط الجروب أو @username"
                value={target}
                onChangeText={setTarget}
                className="bg-background/80 border border-border rounded-xl p-3 text-foreground"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
              />
            </View>
          </GlassCard>

          {/* Advanced Filters */}
          <GlassCard delay={300} className="p-4 gap-4">
            <Text className="text-sm font-semibold text-foreground">فلاتر ذكية</Text>

            <View className="flex-row gap-2">
              {(['all', 'engaged', 'admins'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setExtractMode(mode)}
                  className={`flex-1 py-2 rounded-lg items-center ${extractMode === mode ? 'bg-primary' : 'bg-background/50 border border-border'}`}
                >
                  <Text className={extractMode === mode ? 'text-white font-bold' : 'text-muted'}>
                    {mode === 'all' ? 'الكل' : mode === 'engaged' ? 'المتفاعلين' : 'الأدمن'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row items-center justify-between">
              <Text className="text-foreground text-sm">استبعاد البوتات</Text>
              <Switch value={excludeBots} onValueChange={setExcludeBots} trackColor={{ true: colors.primary }} />
            </View>

            <View className="flex-row items-center justify-between">
              <Text className="text-foreground text-sm">يوزر نيم مطلوب</Text>
              <Switch value={requireUsername} onValueChange={setRequireUsername} trackColor={{ true: colors.primary }} />
            </View>

            <View className="flex-row gap-4">
              <View className="flex-1 gap-1">
                <Text className="text-[10px] text-muted">الحد الأقصى</Text>
                <TextInput
                  value={limit}
                  onChangeText={setLimit}
                  keyboardType="numeric"
                  className="bg-background/80 border border-border rounded-lg p-2 text-foreground text-center"
                />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-[10px] text-muted">التأخير (ms)</Text>
                <TextInput
                  value={delayMs}
                  onChangeText={setDelayMs}
                  keyboardType="numeric"
                  className="bg-background/80 border border-border rounded-lg p-2 text-foreground text-center"
                />
              </View>
            </View>
          </GlassCard>

          {/* Progress Section */}
          {isRunning && (
            <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
              <View className="flex-row justify-between items-center">
                <Text className="text-sm font-bold text-foreground">جاري التنفيذ في السيرفر</Text>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
              <View className="h-2 bg-background rounded-full overflow-hidden">
                <View className="h-full bg-primary" style={{ width: `${progress}%` }} />
              </View>
              <Text className="text-xs text-center text-muted">التقدم: {progress}%</Text>
            </View>
          )}

          {/* Result Summary */}
          {status === 'completed' && result && (
            <View className="bg-success/10 border border-success/20 rounded-2xl p-4 gap-2">
              <Text className="text-sm font-bold text-success">✅ اكتملت العملية بنجاح</Text>
              <Text className="text-xs text-foreground">تم استخراج {result.extracted} عضو وإضافة {result.added} عضو بنجاح.</Text>
            </View>
          )}

          {/* Action Button */}
          <TouchableOpacity
            onPress={handleStart}
            disabled={isRunning || startOperationMutation.isPending}
            className={`py-4 rounded-2xl items-center shadow-sm ${isRunning || startOperationMutation.isPending ? 'bg-muted' : 'bg-primary'}`}
          >
            <View className="flex-row items-center gap-2">
              <IconSymbol name="bolt.fill" size={20} color="white" />
              <Text className="text-white font-bold text-lg">
                {isRunning ? "العملية مستمرة في السيرفر..." : "بدء العملية العملاقة"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Industrial Note */}
          <View className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
            <Text className="text-[11px] text-foreground leading-relaxed text-center">
              🛡️ <Text className="font-bold">تقنية Industrial-Grade:</Text> هذا النظام يستخدم طوابير مهام متقدمة (BullMQ) تضمن استمرار العمل حتى لو انقطع اتصالك بالإنترنت أو أغلق هاتفك.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
