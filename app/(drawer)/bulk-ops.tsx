import { ScrollView, View, Text, Pressable, TextInput, ActivityIndicator, Switch, Alert, TouchableOpacity } from "react-native";
import { useState, useEffect } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { GlassCard } from "@/components/ui/glass-card";
import { trpc } from "@/lib/trpc";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { localSessionStore } from "@/lib/local-session-store";

const trpcAny = trpc as any;

/**
 * Bulk Operations Screen - Power Edition
 * 
 * Central hub for mass messaging, group joining, and member addition.
 * Fully integrated with BullMQ for 24/7 background processing.
 */
export default function BulkOpsScreen() {
  const colors = useColors();
  const [operationType, setOperationType] = useState("messages");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [messageTemplate, setMessageTemplate] = useState("مرحباً {firstName}، شكراً لك!");
  const [targetList, setTargetList] = useState("");
  const [delayMs, setDelayMs] = useState("2000");
  const [autoRepeat, setAutoRepeat] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState("");

  // Fetch accounts for selection
  const { data: accounts, isLoading: loadingAccounts } = trpc.accounts.getAll.useQuery(undefined) as any;

  // API Mutations
  const startBulkMutation = trpc.bulkOps.startSendBulkMessages.useMutation();
  const startAddUsersMutation = trpc.bulkOps.startAddUsersToGroup.useMutation();

  const jobStatusQuery = trpc.bulkOps.getJobStatus.useQuery(
    { jobId: jobId || "" },
    { enabled: !!jobId, refetchInterval: jobId ? 2000 : false }
  ) as any;

  const operationTypes = [
    { id: "messages", label: "رسائل جماعية", icon: "paperplane.fill" as const, color: colors.primary },
    { id: "add-users", label: "إضافة أعضاء", icon: "person.badge.plus.fill" as const, color: colors.success },
    { id: "join-groups", label: "انضمام للجروبات", icon: "person.3.fill" as const, color: colors.warning },
  ];

  const handleStart = async () => {
    if (!selectedAccountId) return Alert.alert("تنبيه", "يرجى اختيار حساب أولاً");
    if (!targetList.trim()) return Alert.alert("تنبيه", "يرجى إدخال قائمة الأهداف");

    const targets = targetList.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    const sessionString = await localSessionStore.getAccountSession(selectedAccountId);

    if (operationType === "messages") {
      if (!messageTemplate) return Alert.alert("تنبيه", "يرجى إدخال نص الرسالة");
      startBulkMutation.mutate({
        accountId: selectedAccountId,
        userIds: targets,
        messageTemplate,
        delayMs: parseInt(delayMs) || 2000,
        autoRepeat,
        sessionString,
      }, {
        onSuccess: (data: any) => {
          setJobId(data.jobId);
          Alert.alert("تم البدء", "تمت إضافة العملية إلى طابور التنفيذ في السيرفر");
        },
        onError: (error: any) => {
          Alert.alert("خطأ", error.message || "فشل بدء العملية");
        },
      });
    } else if (operationType === "add-users") {
      if (!targetGroupId.trim()) return Alert.alert("تنبيه", "يرجى إدخال الجروب الهدف");
      startAddUsersMutation.mutate({
        accountId: selectedAccountId,
        groupId: targetGroupId.trim(),
        userIds: targets,
        delayMs: parseInt(delayMs) || 1000,
        sessionString,
      }, {
        onSuccess: (data: any) => {
          setJobId(data.jobId);
          Alert.alert("تم البدء", "تم إنشاء مهمة الإضافة وإدراجها في طابور السيرفر");
        },
        onError: (error: any) => {
          Alert.alert("خطأ", error.message || "فشل بدء عملية الإضافة");
        },
      });
    } else {
      Alert.alert("قيد التطوير", "سيتم تفعيل هذا النوع من العمليات في التحديث القادم");
    }
  };

  const handleImport = async () => {
    try {
      setIsImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      
      const fileUri = result.assets[0].uri;
      const fileContent = await (FileSystem as any).readAsStringAsync(fileUri, { encoding: "utf8" });
      
      const lines = fileContent.split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      
      if (lines.length > 0) {
        setTargetList(prev => prev ? prev + '\n' + lines.join('\n') : lines.join('\n'));
        Alert.alert("نجاح", `تم استيراد ${lines.length} هدف بنجاح`);
      } else {
        Alert.alert("تنبيه", "الملف فارغ أو لا يحتوي على نصوص صالحة");
      }
    } catch (error: any) {
      Alert.alert("خطأ", "فشل استيراد الملف: " + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const isRunning = jobId && jobStatusQuery.data?.found && (jobStatusQuery.data.status === "running" || jobStatusQuery.data.status === "queued");

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-6 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">العمليات الضخمة</Text>
            <Text className="text-sm text-muted">نفذ آلاف العمليات في السيرفر دون استهلاك بطارية هاتفك</Text>
          </View>

          {/* Account Selection */}
          <GlassCard delay={100} className="p-4 gap-3">
            <Text className="text-sm font-semibold text-foreground">حساب التنفيذ</Text>
            {loadingAccounts ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                {(accounts as any)?.map((account: any) => (
                  <Pressable
                    key={account.id}
                    onPress={() => setSelectedAccountId(account.id)}
                    className={`px-4 py-2 rounded-xl border ${selectedAccountId === account.id ? 'border-primary bg-primary/20' : 'border-border bg-background/50'}`}
                  >
                    <Text style={{ color: selectedAccountId === account.id ? colors.primary : colors.foreground, fontWeight: selectedAccountId === account.id ? 'bold' : 'normal' }}>
                      {account.phoneNumber}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </GlassCard>

          {/* Operation Type Selector */}
          <View className="flex-row gap-2">
            {operationTypes.map((op) => (
              <Pressable
                key={op.id}
                onPress={() => setOperationType(op.id)}
                className={`flex-1 p-3 rounded-2xl items-center border ${operationType === op.id ? 'bg-surface border-primary' : 'bg-surface border-border'}`}
              >
                <View className={`w-10 h-10 rounded-full items-center justify-center mb-2 ${operationType === op.id ? 'bg-primary/10' : 'bg-muted/10'}`}>
                  <IconSymbol name={op.icon} size={20} color={operationType === op.id ? colors.primary : colors.muted} />
                </View>
                <Text className={`text-xs text-center ${operationType === op.id ? 'text-primary font-bold' : 'text-muted'}`}>
                  {op.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Configuration Section */}
          <GlassCard delay={200} className="p-4 gap-4">
            <Text className="text-sm font-semibold text-foreground">إعدادات العملية</Text>

            {/* Target List */}
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted">قائمة الأهداف (يوزر نيم أو ID)</Text>
                <TouchableOpacity
                  onPress={handleImport}
                  disabled={isImporting}
                  className="flex-row items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg"
                >
                  {isImporting ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <IconSymbol name="plus.rectangle.on.folder.fill" size={14} color={colors.primary} />
                  )}
                  <Text className="text-xs font-bold text-primary">استيراد من ملف</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                multiline
                numberOfLines={5}
                placeholder={"@username1\n123456789\n@username2"}
                value={targetList}
                onChangeText={setTargetList}
                className="bg-background border border-border rounded-xl p-3 text-foreground min-h-[100px]"
                placeholderTextColor={colors.muted}
              />
            </View>

            {/* Message Template */}
            {operationType === "messages" && (
              <View className="gap-2">
                <Text className="text-xs text-muted">نص الرسالة (يدعم المتغيرات الذكية)</Text>
                <TextInput
                  multiline
                  numberOfLines={4}
                  placeholder="مرحباً {firstName}..."
                  value={messageTemplate}
                  onChangeText={setMessageTemplate}
                  className="bg-background border border-border rounded-xl p-3 text-foreground min-h-[80px]"
                  placeholderTextColor={colors.muted}
                />
                <View className="bg-primary/5 rounded-lg p-2">
                  <Text className="text-[10px] text-primary">
                    💡 استخدم: {"{firstName}"}, {"{username}"} للتخصيص التلقائي.
                  </Text>
                </View>
              </View>
            )}

            {/* Target Group ID (Add Users mode) */}
            {operationType === "add-users" && (
              <View className="gap-2">
                <Text className="text-xs text-muted">الجروب الهدف (أين تريد إضافة الأعضاء؟)</Text>
                <TextInput
                  placeholder="رابط الجروب أو @username"
                  value={targetGroupId}
                  onChangeText={setTargetGroupId}
                  className="bg-background border border-border rounded-xl p-3 text-foreground"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                />
                <View className="bg-primary/5 rounded-lg p-2 mt-1">
                  <Text className="text-[10px] text-primary">
                    💡 تأكد من أن الحساب لديه صلاحية الإضافة أو أن الجروب مفتوح للإضافات.
                  </Text>
                </View>
              </View>
            )}

            {/* Delay & Options */}
            <View className="flex-row gap-4">
              <View className="flex-1 gap-2">
                <Text className="text-xs text-muted">التأخير (ms)</Text>
                <TextInput
                  value={delayMs}
                  onChangeText={setDelayMs}
                  keyboardType="numeric"
                  className="bg-background border border-border rounded-xl p-3 text-foreground text-center"
                />
              </View>
              <View className="flex-1 justify-center items-center gap-1">
                <Text className="text-xs text-muted">تشغيل 24/7</Text>
                <Switch value={autoRepeat} onValueChange={setAutoRepeat} trackColor={{ true: colors.primary }} />
              </View>
            </View>
          </GlassCard>

          {/* Progress Section */}
          {jobId && jobStatusQuery.data?.found && (
            <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
              <View className="flex-row justify-between items-center">
                <Text className="text-sm font-bold text-foreground">حالة التنفيذ الفوري</Text>
                <View className={`px-2 py-1 rounded-lg ${jobStatusQuery.data.status === 'completed' ? 'bg-success/10' : 'bg-primary/10'}`}>
                  <Text className={`text-xs font-bold ${jobStatusQuery.data.status === 'completed' ? 'text-success' : 'text-primary'}`}>
                    {jobStatusQuery.data.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View className="h-2 bg-background rounded-full overflow-hidden">
                <View
                  className="h-full bg-primary"
                  style={{ width: `${jobStatusQuery.data.progress}%` }}
                />
              </View>

              <View className="flex-row justify-between">
                <Text className="text-xs text-muted">التقدم: {jobStatusQuery.data.progress}%</Text>
                {jobStatusQuery.data.result && (
                  <Text className="text-xs text-success font-bold">
                    نجاح: {jobStatusQuery.data.result.success} | فشل: {jobStatusQuery.data.result.failed}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Action Button */}
          <Pressable
            onPress={handleStart}
            disabled={isRunning || startBulkMutation.isPending || startAddUsersMutation.isPending}
            className={`py-4 rounded-2xl items-center shadow-sm ${isRunning || startBulkMutation.isPending || startAddUsersMutation.isPending ? 'bg-muted' : 'bg-primary'}`}
          >
            <View className="flex-row items-center gap-2">
              {isRunning || startBulkMutation.isPending || startAddUsersMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <IconSymbol name="play.fill" size={20} color="white" />
              )}
              <Text className="text-white font-bold text-lg">
                {isRunning ? "جاري التنفيذ في السيرفر..." : operationType === 'add-users' ? "بدء الإضافة الجماعية" : "بدء العملية الجماعية"}
              </Text>
            </View>
          </Pressable>

          {/* Safety Note */}
          <View className="bg-error/5 border border-error/10 rounded-2xl p-4 flex-row gap-3">
            <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.error} />
            <Text className="text-xs text-foreground flex-1 leading-relaxed">
              <Text className="font-bold text-error">تنبيه الحماية:</Text> نظام Anti-Ban سيقوم بتعديل التأخير تلقائياً إذا اكتشف مخاطر عالية، حتى لو قمت بتحديد تأخير أقل.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
