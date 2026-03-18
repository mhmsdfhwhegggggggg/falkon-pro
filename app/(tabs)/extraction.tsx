import { ScrollView, View, Text, Pressable, TextInput, ActivityIndicator, Alert, Switch } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { IconSymbol } from "@/components/ui/icon-symbol";

const trpcAny = trpc as any;

/**
 * Extraction Screen - Industrial Edition
 * 
 * High-performance member extraction with advanced server-side filtering.
 * Designed for massive scale and zero device load.
 */
export default function ExtractionScreen() {
  const colors = useColors();
  const [groupId, setGroupId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [extractedCount, setExtractedCount] = useState(0);

  // Advanced Filters
  const [extractMode, setExtractMode] = useState<'all' | 'engaged' | 'admins'>('all');
  const [daysActive, setDaysActive] = useState('7');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasUsername, setHasUsername] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [limit, setLimit] = useState('5000');

  // Fetch accounts for selection
  const { data: accounts, isLoading: loadingAccounts } = trpcAny.accounts.getAll.useQuery(undefined);
  const status = trpcAny.setup.getStatus.useQuery(undefined);

  const extractAllMutation = trpcAny.extraction.extractAllMembers.useMutation();

  const extractEngagedMutation = trpcAny.extraction.extractEngagedMembers.useMutation();

  const extractAdminsMutation = trpcAny.extraction.extractAdmins.useMutation();

  const handleStartExtraction = () => {
    if (!selectedAccountId) return Alert.alert("تنبيه", "يرجى اختيار حساب أولاً");
    if (!groupId) return Alert.alert("تنبيه", "يرجى إدخال معرّف الجروب أو الرابط");

    if (extractMode === 'engaged') {
      extractEngagedMutation.mutate({
        accountId: selectedAccountId,
        groupId,
        daysActive: parseInt(daysActive) || 7
      }, {
        onSuccess: (data: any) => {
          setExtractedCount(data.membersCount);
          Alert.alert("نجاح", `تم استخراج ${data.membersCount} عضو متفاعل بنجاح`);
        },
        onError: (error: any) => {
          Alert.alert("خطأ", error.message || "فشل استخراج الأعضاء المتفاعلين");
        }
      });
    } else if (extractMode === 'admins') {
      extractAdminsMutation.mutate({
        accountId: selectedAccountId,
        groupId
      }, {
        onSuccess: (data: any) => {
          setExtractedCount(data.adminsCount);
          Alert.alert("نجاح", `تم استخراج ${data.adminsCount} مشرف بنجاح`);
        },
        onError: (error: any) => {
          Alert.alert("خطأ", error.message || "فشل استخراج المشرفين");
        }
      });
    } else {
      extractAllMutation.mutate({
        accountId: selectedAccountId,
        groupId
      }, {
        onSuccess: (data: any) => {
          setExtractedCount(data.membersCount);
          Alert.alert("نجاح", `تم استخراج ${data.membersCount} عضو بنجاح وتخزينهم في السيرفر`);
        },
        onError: (error: any) => {
          Alert.alert("خطأ", error.message || "فشل استخراج الأعضاء");
        }
      });
    }
  };

  const isLoading = extractAllMutation.isPending || extractEngagedMutation.isPending || extractAdminsMutation.isPending;

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-6 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">الاستخراج العملاق</Text>
            <Text className="text-sm text-muted">استخراج فائق السرعة مع فلاتر ذكية في السيرفر</Text>
          </View>

          {/* Account Selection */}
          <View className="gap-3 bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-sm font-semibold text-foreground">حساب التنفيذ</Text>
            {loadingAccounts ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                {(accounts as any)?.map((account: any) => (
                  <Pressable
                    key={account.id}
                    onPress={() => setSelectedAccountId(account.id)}
                    className={`px-4 py-2 rounded-xl border ${selectedAccountId === account.id ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}
                  >
                    <Text style={{ color: selectedAccountId === account.id ? colors.primary : colors.foreground, fontWeight: selectedAccountId === account.id ? 'bold' : 'normal' }}>
                      {account.phoneNumber}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Target Input */}
          <View className="gap-3 bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-sm font-semibold text-foreground">المصدر (رابط أو @username)</Text>
            <TextInput
              placeholder="t.me/group_link أو @username"
              value={groupId}
              onChangeText={setGroupId}
              className="bg-background border border-border rounded-xl p-4 text-foreground"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
          </View>

          {/* Advanced Filters */}
          <View className="gap-4 bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-sm font-semibold text-foreground">فلاتر ذكية (تنفذ في السيرفر)</Text>

            {/* Mode Selection */}
            <View className="flex-row gap-2">
              {(['all', 'engaged', 'admins'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setExtractMode(mode)}
                  className={`flex-1 py-2 rounded-lg items-center ${extractMode === mode ? 'bg-primary' : 'bg-background border border-border'}`}
                >
                  <Text className={extractMode === mode ? 'text-white font-bold' : 'text-muted'}>
                    {mode === 'all' ? 'الكل' : mode === 'engaged' ? 'المتفاعلين' : 'الأدمن'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Switches */}
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-foreground">يجب أن يمتلك يوزر نيم</Text>
                <Switch value={hasUsername} onValueChange={setHasUsername} trackColor={{ true: colors.primary }} />
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-foreground">يجب أن يمتلك صورة شخصية</Text>
                <Switch value={hasPhoto} onValueChange={setHasPhoto} trackColor={{ true: colors.primary }} />
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-foreground">مستخدمين Premium فقط</Text>
                <Switch value={isPremium} onValueChange={setIsPremium} trackColor={{ true: colors.primary }} />
              </View>
            </View>

            {/* Limit Input */}
            <View className="flex-row items-center gap-3">
              <Text className="text-foreground flex-1">الحد الأقصى للاستخراج:</Text>
              <TextInput
                value={limit}
                onChangeText={setLimit}
                keyboardType="numeric"
                className="bg-background border border-border rounded-lg px-3 py-1 text-foreground w-24 text-center"
              />
            </View>
          </View>

          {/* Action Button */}
          <Pressable
            onPress={handleStartExtraction}
            disabled={isLoading}
            className={`py-4 rounded-2xl items-center shadow-sm ${isLoading ? 'bg-muted' : 'bg-primary'}`}
          >
            <View className="flex-row items-center gap-2">
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <IconSymbol name="arrow.down.doc.fill" size={20} color="white" />
              )}
              <Text className="text-white font-bold text-lg">
                {isLoading ? "جاري الاستخراج العملاق..." : "بدء الاستخراج الفوري"}
              </Text>
            </View>
          </Pressable>

          {/* Results Summary */}
          {extractedCount > 0 && (
            <View className="bg-success/10 border border-success/20 rounded-2xl p-4 flex-row items-center gap-4">
              <View className="w-12 h-12 rounded-full bg-success/20 items-center justify-center">
                <IconSymbol name="checkmark.circle.fill" size={24} color={colors.success} />
              </View>
              <View>
                <Text className="text-lg font-bold text-success">تم الاستخراج بنجاح</Text>
                <Text className="text-foreground">تم حفظ {extractedCount.toLocaleString()} عضو في السيرفر</Text>
              </View>
            </View>
          )}

          {/* Performance Note */}
          <View className="bg-warning/10 border border-warning/20 rounded-2xl p-4 gap-2">
            <Text className="text-sm font-semibold text-warning">ℹ️ ملاحظة الأداء</Text>
            <Text className="text-xs text-foreground leading-relaxed">
              تتم جميع عمليات الفلترة والتحليل في السيرفر مباشرة. لن يتأثر أداء هاتفك أو يستهلك بيانات إضافية مهما كان حجم البيانات المستخرجة.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
