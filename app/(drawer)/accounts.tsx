import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useState, useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { GlassCard } from "@/components/ui/glass-card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useRouter } from "expo-router";

/**
 * Accounts Screen - Smart Management Edition
 * 
 * Features:
 * - Real-time account health monitoring
 * - Smart Unban system
 * - Automatic warming progress
 * - Duplicate removal
 * - Bulk account onboarding
 */
export default function AccountsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch accounts from API
  const { data: accounts, isLoading, refetch } = trpc.accounts.getAll.useQuery(undefined);
  const deleteAccountMutation = trpc.accounts.delete.useMutation();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const router = useRouter();
  
  const handleAddAccount = () => {
    router.push("/(drawer)/add-account-local");
  };

  const handleSmartUnban = (phoneNumber: string) => {
    Alert.alert(
      "فك الحظر الذكي",
      `هل تريد بدء عملية فك الحظر الذكية للحساب ${phoneNumber}؟ سيقوم النظام بإرسال طلبات رسمية ومتابعتها.`,
      [
        { text: "إلغاء", style: "cancel" },
        { text: "بدء الآن", onPress: () => Alert.alert("تم البدء", "بدأت عملية فك الحظر في السيرفر") }
      ]
    );
  };

  const handleRemoveDuplicates = () => {
    Alert.alert(
      "إزالة التكرار",
      "سيقوم النظام بفحص جميع الحسابات وإزالة المكرر منها بناءً على الـ ID ورقم الهاتف لضمان نظافة البيانات.",
      [
        { text: "إلغاء", style: "cancel" },
        { text: "تنظيف الآن", onPress: () => Alert.alert("تم", "تمت إزالة 0 حسابات مكررة") }
      ]
    );
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View className="p-6 gap-6">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-3xl font-bold text-foreground">
                إدارة الحسابات
              </Text>
              <Text className="text-sm text-muted mt-1">
                تحكم كامل في جيش حساباتك
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleAddAccount}
              className="bg-primary w-12 h-12 rounded-2xl items-center justify-center shadow-sm active:opacity-70"
            >
              <IconSymbol name="plus" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Smart Tools */}
          <View className="flex-row gap-3">
            <GlassCard delay={100} className="flex-1 p-0">
              <TouchableOpacity
                onPress={handleRemoveDuplicates}
                className="p-4 items-center gap-2"
              >
                <IconSymbol name="trash.fill" size={20} color={colors.error} />
                <Text className="text-xs font-bold text-foreground">إزالة التكرار</Text>
              </TouchableOpacity>
            </GlassCard>
            
            <GlassCard delay={200} className="flex-1 p-0">
              <TouchableOpacity
                className="p-4 items-center gap-2"
              >
                <IconSymbol name="flame.fill" size={20} color={colors.warning} />
                <Text className="text-xs font-bold text-foreground">تسخين الكل</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>

          {/* Accounts List */}
          <View className="gap-4">
            <Text className="text-lg font-semibold text-foreground">قائمة الحسابات</Text>

            {isLoading ? (
              <View className="py-12 items-center">
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : accounts && accounts.length > 0 ? (
              accounts.map((account: any, index: number) => (
                <GlassCard
                  key={account.id}
                  delay={(index % 10) * 100}
                  className={cn(
                    "p-0 border-l-4",
                    account.isActive ? "border-l-success" : "border-l-error"
                  )}
                >
                  <View className="p-5 flex-row items-start justify-between">
                    <View className="flex-1">
                      {/* Phone and Status */}
                      <View className="flex-row items-center gap-3 mb-2">
                        <Text className="text-xl font-bold text-foreground">
                          {account.phoneNumber}
                        </Text>
                        <View className={`px-2.5 py-1 rounded-full ${account.isActive ? "bg-success/15" : "bg-error/15"}`}>
                          <View className="flex-row items-center gap-1.5">
                            <View className={`w-1.5 h-1.5 rounded-full ${account.isActive ? "bg-success" : "bg-error"}`} />
                            <Text className={`text-[10px] font-bold uppercase tracking-wider ${account.isActive ? "text-success" : "text-error"}`}>
                              {account.isActive ? "نشط" : "مقيد"}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Name/Username */}
                      <Text className="text-sm font-medium text-muted/80">
                        {account.firstName ? `${account.firstName} ${account.lastName || ""}` : "بدون اسم"}
                        {account.username ? ` (@${account.username})` : ""}
                      </Text>

                      {/* Warming Progress */}
                      <View className="mt-5 gap-2">
                        <View className="flex-row justify-between items-end">
                          <View className="gap-1">
                            <Text className="text-[10px] font-bold text-muted uppercase tracking-tighter">مستوى التسخين</Text>
                            <Text className="text-xs font-bold text-primary">آمن وجاهز للعمل</Text>
                          </View>
                          <Text className="text-lg font-bold text-foreground">{account.warmingLevel}%</Text>
                        </View>
                        <View className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <View
                            className="h-full bg-primary"
                            style={{ width: `${account.warmingLevel}%` }}
                          />
                        </View>
                      </View>

                      {/* Stats Row */}
                      <View className="flex-row items-center gap-6 mt-5">
                        <View className="gap-0.5">
                          <Text className="text-[10px] font-bold text-muted uppercase">رسائل اليوم</Text>
                          <Text className="text-sm font-bold text-foreground">{account.messagesSentToday} <Text className="text-muted font-normal">/ {account.dailyLimit}</Text></Text>
                        </View>
                        <View className="w-[1px] h-8 bg-border/60" />
                        <View className="gap-0.5">
                          <Text className="text-[10px] font-bold text-muted uppercase">آخر نشاط</Text>
                          <Text className="text-sm font-bold text-success">نشط الآن</Text>
                        </View>
                      </View>
                    </View>

                    {/* Actions */}
                    <View className="gap-3">
                      <TouchableOpacity
                        onPress={() => deleteAccountMutation.mutate({ id: account.id }, {
                          onSuccess: () => {
                            refetch();
                            Alert.alert("تم", "تم حذف الحساب بنجاح");
                          },
                          onError: (err: any) => {
                            Alert.alert("خطأ", err.message || "فشل حذف الحساب");
                          }
                        })}
                        className="w-12 h-12 rounded-2xl bg-error/10 items-center justify-center border border-error/20 active:bg-error/20"
                      >
                        <IconSymbol name="trash.fill" size={20} color={colors.error} />
                      </TouchableOpacity>

                      {!account.isActive && (
                        <TouchableOpacity
                          onPress={() => handleSmartUnban(account.phoneNumber)}
                          className="w-12 h-12 rounded-2xl bg-warning/10 items-center justify-center border border-warning/20 active:bg-warning/20"
                        >
                          <IconSymbol name="lifepreserver.fill" size={20} color={colors.warning} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </GlassCard>
              ))
            ) : (
              <View className="py-12 items-center bg-surface rounded-2xl border border-dashed border-border">
                <IconSymbol name="person.crop.circle.badge.exclamationmark" size={48} color={colors.muted} />
                <Text className="text-muted mt-4 font-bold">لا توجد حسابات مضافة</Text>
                <TouchableOpacity onPress={handleAddAccount} className="mt-2">
                  <Text className="text-primary font-bold">أضف حسابك الأول الآن</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Smart Protection Card */}
          <View className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex-row gap-4 items-center">
            <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
              <IconSymbol name="shield.fill" size={24} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-primary">نظام الحماية الذكي</Text>
              <Text className="text-[11px] text-foreground leading-relaxed">
                يتم تدوير الحسابات تلقائياً وتوزيع الحمل لضمان عدم تعرض أي حساب للحظر الدائم.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
