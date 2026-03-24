import { useMemo, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable, ActivityIndicator, Alert, TouchableOpacity } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { IconSymbol } from "@/components/ui/icon-symbol";

const trpcAny = trpc as any;

export default function OnboardingScreen() {
  const colors = useColors();
  const [phonesCsv, setPhonesCsv] = useState("");
  const [confirmCsv, setConfirmCsv] = useState("");
  const [sendJobId, setSendJobId] = useState<string | null>(null);
  const [confirmJobId, setConfirmJobId] = useState<string | null>(null);

  const sendMutation = trpc.accounts.bulkSendLoginCodes.useMutation();
  const confirmMutation = trpc.accounts.bulkConfirmCodes.useMutation();
  
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
    const items: { phoneNumber: string; code: string; password?: string; apiId?: number; apiHash?: string }[] = [];
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const parts = line.split(",").map((s) => (s ? s.trim() : ""));
      const [phoneNumber, code, password, apiId, apiHash] = parts;
      if (!phoneNumber || !code) continue;
      items.push({ 
        phoneNumber, 
        code, 
        password: password || undefined,
        apiId: apiId ? parseInt(apiId) : undefined,
        apiHash: apiHash || undefined
      });
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

  const handleAutoExtractApi = () => {
    const lines = confirmCsv.split(/\r?\n/).filter(Boolean);
    const updatedLines = lines.map(line => {
      const parts = line.split(',');
      if (parts.length < 4) {
        const phone = parts[0]?.trim();
        const code = parts[1]?.trim();
        const pass = parts[2]?.trim() || "";
        if (phone && code) {
          // Official Android API Pair
          return `${phone},${code},${pass},6,eb06d4ab352def3c2643ad7a997439fb`;
        }
      }
      return line;
    });
    setConfirmCsv(updatedLines.join('\n'));
    Alert.alert("تم الاستخراج", "تم استخراج وربط مفاتيح API الرسمية لجميع الحسابات في القائمة.");
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-4 gap-4">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Onboarding FALKON PRO</Text>
            <Text className="text-sm text-muted">إرسال وتأكيد أكواد الدخول لدفعات كبيرة بسهولة</Text>
          </View>

          {/* Send Codes Section */}
          <View className="bg-surface rounded-lg p-4 gap-3 shadow-sm border border-border">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-semibold text-foreground">1) إرسال الأكواد (قائمة أرقام)</Text>
              <View className="bg-primary/10 px-2 py-1 rounded">
                <Text className="text-[10px] text-primary font-bold">خطوة 1</Text>
              </View>
            </View>
            <Text className="text-xs text-muted">CSV (رقم هاتف في كل سطر)</Text>
            <TextInput
              multiline
              numberOfLines={6}
              placeholder={"+966500000000\n+201000000000"}
              value={phonesCsv}
              onChangeText={setPhonesCsv}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 10,
                color: colors.foreground,
                backgroundColor: colors.background,
                minHeight: 100,
              }}
              placeholderTextColor={colors.muted}
            />
            <Pressable
              onPress={handleSendCodes}
              disabled={disableSend || sendMutation.isPending}
              style={{
                backgroundColor: disableSend || sendMutation.isPending ? colors.muted : colors.primary,
                paddingVertical: 12,
                borderRadius: 8,
                opacity: disableSend || sendMutation.isPending ? 0.6 : 1,
              }}
            >
              <View className="flex-row items-center justify-center gap-2">
                {sendMutation.isPending && <ActivityIndicator color="white" />}
                <Text className="text-white font-semibold text-center">بدء إرسال الأكواد</Text>
              </View>
            </Pressable>
            {sendJobId && (sendJobStatus.data as any)?.found && (
              <View className="bg-surface rounded-lg p-3 border border-border mt-2">
                <Text className="text-sm text-foreground">مهمة الإرسال: {sendJobId}</Text>
                <Text className="text-sm text-foreground font-bold">الحالة: {(sendJobStatus.data as any).status}</Text>
                <Text className="text-sm text-foreground">التقدم: {(sendJobStatus.data as any).progress}%</Text>
              </View>
            )}
          </View>

          {/* Confirm Codes Section */}
          <View className="bg-surface rounded-lg p-4 gap-3 shadow-sm border border-border">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-semibold text-foreground">2) تأكيد الأكواد وإنشاء الحسابات</Text>
              <View className="bg-success/10 px-2 py-1 rounded">
                <Text className="text-[10px] text-success font-bold">خطوة 2</Text>
              </View>
            </View>
            
            <View className="flex-row justify-between items-center bg-primary/5 p-2 rounded-lg">
              <Text className="text-[10px] text-primary flex-1 mr-2">تنسيق الـ CSV المتقدم: phoneNumber,code,password,apiId,apiHash</Text>
              <TouchableOpacity onPress={handleAutoExtractApi} className="bg-primary/20 px-2 py-1 rounded">
                <Text className="text-[10px] text-primary font-bold">✨ استخراج API</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              multiline
              numberOfLines={6}
              placeholder={"+966500000000,12345\n+201000000000,67890,pass123"}
              value={confirmCsv}
              onChangeText={setConfirmCsv}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 10,
                color: colors.foreground,
                backgroundColor: colors.background,
                minHeight: 120,
              }}
              placeholderTextColor={colors.muted}
            />
            <Pressable
              onPress={handleConfirmCodes}
              disabled={disableConfirm || confirmMutation.isPending}
              style={{
                backgroundColor: disableConfirm || confirmMutation.isPending ? colors.muted : colors.primary,
                paddingVertical: 12,
                borderRadius: 8,
                opacity: disableConfirm || confirmMutation.isPending ? 0.6 : 1,
              }}
            >
              <View className="flex-row items-center justify-center gap-2">
                {confirmMutation.isPending && <ActivityIndicator color="white" />}
                <Text className="text-white font-semibold text-center">تأكيد الأكواد وإنشاء الجلسات</Text>
              </View>
            </Pressable>
            {confirmJobId && (confirmJobStatus.data as any)?.found && (
              <View className="bg-surface rounded-lg p-3 border border-border mt-2">
                <Text className="text-sm text-foreground">مهمة التأكيد: {confirmJobId}</Text>
                <Text className="text-sm text-foreground">الحالة: {(confirmJobStatus.data as any).status}</Text>
                <Text className="text-sm text-foreground">التقدم: {(confirmJobStatus.data as any).progress}%</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
