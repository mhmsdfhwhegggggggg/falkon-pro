import { useMemo, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

const trpcAny = trpc as any;
export default function OnboardingScreen() {
  const colors = useColors();
  const [phonesCsv, setPhonesCsv] = useState("");
  const [confirmCsv, setConfirmCsv] = useState("");
  const [sendJobId, setSendJobId] = useState<string | null>(null);
  const [confirmJobId, setConfirmJobId] = useState<string | null>(null);

  const sendMutation = trpc.accounts.bulkSendLoginCodes.useMutation();

  const confirmMutation = trpc.accounts.bulkConfirmCodes.useMutation();
  const { data: accounts } = (trpcAny.accounts.getAll.useQuery(undefined) as any);
  const { data: proxies } = (trpcAny.proxies.getAll.useQuery(undefined) as any);
  const sendJobStatus = (trpcAny.bulkOps.getJobStatus.useQuery(
    { jobId: sendJobId || "" },
    { enabled: !!sendJobId, refetchInterval: 1000 }
  ) as any);
  const confirmJobStatus = (trpcAny.bulkOps.getJobStatus.useQuery(
    { jobId: confirmJobId || "" },
    { enabled: !!confirmJobId, refetchInterval: 1000 }
  ) as any);

  const disableSend = useMemo(() => phonesCsv.trim().length === 0, [phonesCsv]);
  const disableConfirm = useMemo(() => confirmCsv.trim().length === 0, [confirmCsv]);

  const parsePhonesFromCsv = (text: string) => {
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  };

  const parseConfirmItemsFromCsv = (text: string) => {
    // CSV: phoneNumber,code,password(optional)
    const items: { phoneNumber: string; code: string; password?: string }[] = [];
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const [phoneNumber, code, password] = line.split(",").map((s) => (s ? s.trim() : ""));
      if (!phoneNumber || !code) continue;
      items.push({ phoneNumber, code, password: password || undefined });
    }
    return items;
  };

  const handleSendCodes = () => {
    const phones = parsePhonesFromCsv(phonesCsv);
    if (phones.length === 0) return Alert.alert("تنبيه", "أدخل أرقام هواتف صالحة");
    sendMutation.mutate({ phoneNumbers: phones }, {
      onSuccess: (res: any) => {
        setSendJobId(res.jobId);
        Alert.alert("تم", "تمت إضافة مهمة إرسال الأكواد للطابور");
      },
      onError: (err: any) => Alert.alert("خطأ", err.message || "فشل إرسال الأكواد"),
    });
  };

  const handleConfirmCodes = () => {
    const items = parseConfirmItemsFromCsv(confirmCsv);
    if (items.length === 0) return Alert.alert("تنبيه", "أدخل بيانات تأكيد صحيحة");
    confirmMutation.mutate({ items }, {
      onSuccess: (res: any) => {
        setConfirmJobId(res.jobId);
        Alert.alert("تم", "تمت إضافة مهمة تأكيد الأكواد للطابور");
      },
      onError: (err: any) => Alert.alert("خطأ", err.message || "فشل تأكيد الأكواد"),
    });
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="p-6 gap-8">
          {/* Header Section */}
          <View className="gap-3">
            <View className="bg-primary/20 w-16 h-16 rounded-3xl items-center justify-center border border-primary/30">
              <IconSymbol name="person.badge.plus" size={32} color={colors.primary} />
            </View>
            <View>
              <Text className="text-3xl font-black text-foreground tracking-tight">إضافة حسابات</Text>
              <Text className="text-base text-muted/70 font-medium">نظام الربط الجماعي الذكي (Bulk Onboarding)</Text>
            </View>
          </View>

          {/* Step 1: Send Codes */}
          <GlassCard className="p-0 border-l-4 border-l-primary overflow-hidden">
            <View className="p-6 gap-5">
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                  <Text className="text-white font-black text-xs">1</Text>
                </View>
                <Text className="text-lg font-bold text-foreground">طلب أكواد التحقق</Text>
              </View>

              <View className="bg-zinc-100/50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-border/40">
                <Text className="text-xs font-bold text-muted uppercase mb-3 tracking-widest">تحميل قائمة الأرقام (CSV)</Text>
                <TextInput
                  multiline
                  numberOfLines={6}
                  placeholder={"أدخل الأرقام هنا...\nمثال:\n+966500000000\n+201000000000"}
                  value={phonesCsv}
                  onChangeText={setPhonesCsv}
                  style={{
                    color: colors.foreground,
                    fontSize: 15,
                    minHeight: 120,
                    textAlignVertical: 'top',
                    fontFamily: 'monospace'
                  }}
                  placeholderTextColor={colors.muted}
                />
              </View>

              <Pressable
                onPress={handleSendCodes}
                disabled={disableSend || sendMutation.isPending}
                className={cn(
                  "h-14 rounded-2xl items-center justify-center border-b-4",
                  disableSend || sendMutation.isPending 
                    ? "bg-zinc-300 border-zinc-400" 
                    : "bg-primary border-primary-dark"
                )}
                style={({ pressed }) => ({
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  opacity: disableSend || sendMutation.isPending ? 0.6 : 1,
                  borderBottomWidth: pressed ? 0 : 4,
                  marginTop: pressed ? 4 : 0
                })}
              >
                <View className="flex-row items-center gap-3">
                  {sendMutation.isPending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <IconSymbol name="paperplane.fill" size={18} color="white" />
                  )}
                  <Text className="text-white font-black text-base">إرسال طلبات الكود</Text>
                </View>
              </Pressable>

              {sendJobId && (sendJobStatus.data as any)?.found && (
                <View className="bg-primary/5 rounded-2xl p-4 border border-primary/20 mt-2">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-xs font-bold text-primary uppercase">حالة المهمة: {sendJobId}</Text>
                    <Text className="text-xs font-black text-primary">{(sendJobStatus.data as any).progress}%</Text>
                  </View>
                  <View className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <View className="h-full bg-primary" style={{ width: `${(sendJobStatus.data as any).progress}%` }} />
                  </View>
                </View>
              )}
            </View>
          </GlassCard>

          {/* Step 2: Confirm Codes */}
          <GlassCard className="p-0 border-l-4 border-l-success overflow-hidden mb-8">
            <View className="p-6 gap-5">
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-full bg-success items-center justify-center">
                  <Text className="text-white font-black text-xs">2</Text>
                </View>
                <Text className="text-lg font-bold text-foreground">تأكيد الأكواد وإنشاء الحسابات</Text>
              </View>

              <View className="bg-zinc-100/50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-border/40">
                <View className="flex-row justify-between mb-3">
                  <Text className="text-xs font-bold text-muted uppercase tracking-widest">تنسيق البيانات: الهاتف,الكود,كلمة المرور</Text>
                </View>
                <TextInput
                  multiline
                  numberOfLines={6}
                  placeholder={"مثال:\n+966500000000,12345\n+201000000000,67890,pass123"}
                  value={confirmCsv}
                  onChangeText={setConfirmCsv}
                  style={{
                    color: colors.foreground,
                    fontSize: 15,
                    minHeight: 120,
                    textAlignVertical: 'top',
                    fontFamily: 'monospace'
                  }}
                  placeholderTextColor={colors.muted}
                />
              </View>

              <Pressable
                onPress={handleConfirmCodes}
                disabled={disableConfirm || confirmMutation.isPending}
                className={cn(
                  "h-14 rounded-2xl items-center justify-center border-b-4",
                  disableConfirm || confirmMutation.isPending 
                    ? "bg-zinc-300 border-zinc-400" 
                    : "bg-success border-success-dark"
                )}
                style={({ pressed }) => ({
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  opacity: disableConfirm || confirmMutation.isPending ? 0.6 : 1,
                  borderBottomWidth: pressed ? 0 : 4,
                  marginTop: pressed ? 4 : 0
                })}
              >
                <View className="flex-row items-center gap-3">
                  {confirmMutation.isPending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <IconSymbol name="checkmark.seal.fill" size={20} color="white" />
                  )}
                  <Text className="text-white font-black text-base">تنشيط وربط الحسابات</Text>
                </View>
              </Pressable>

              {confirmJobId && (confirmJobStatus.data as any)?.found && (
                <View className="bg-success/5 rounded-2xl p-4 border border-success/20 mt-2">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-xs font-bold text-success uppercase">حالة المهمة: {confirmJobId}</Text>
                    <Text className="text-xs font-black text-success">{(confirmJobStatus.data as any).progress}%</Text>
                  </View>
                  <View className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <View className="h-full bg-success" style={{ width: `${(confirmJobStatus.data as any).progress}%` }} />
                  </View>
                </View>
              )}
            </View>
          </GlassCard>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
