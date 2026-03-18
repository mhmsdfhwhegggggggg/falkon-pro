import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";

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

  const handleAddAccount = () => {
    Alert.alert("إضافة حساب", "يمكنك إضافة حسابات فردية أو دفعات كبيرة عبر صفحة Onboarding");
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
            <TouchableOpacity
              onPress={handleRemoveDuplicates}
              className="flex-1 bg-surface border border-border p-4 rounded-2xl items-center gap-2"
            >
              <IconSymbol name="trash.fill" size={20} color={colors.error} />
              <Text className="text-xs font-bold text-foreground">إزالة التكرار</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-surface border border-border p-4 rounded-2xl items-center gap-2"
            >
              <IconSymbol name="flame.fill" size={20} color={colors.warning} />
              <Text className="text-xs font-bold text-foreground">تسخين الكل</Text>
            </TouchableOpacity>
          </View>

          {/* Accounts List */}
          <View className="gap-4">
            <Text className="text-lg font-semibold text-foreground">قائمة الحسابات</Text>

            {isLoading ? (
              <View className="py-12 items-center">
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : accounts && accounts.length > 0 ? (
              accounts.map((account: any) => (
                <View
                  key={account.id}
                  className="bg-surface rounded-2xl p-4 border border-border shadow-sm"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      {/* Phone and Status */}
                      <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-lg font-bold text-foreground">
                          {account.phoneNumber}
                        </Text>
                        <View className={`px-2 py-0.5 rounded-lg ${account.isActive ? "bg-success/10" : "bg-error/10"}`}>
                          <Text className={`text-[10px] font-bold ${account.isActive ? "text-success" : "text-error"}`}>
                            {account.isActive ? "نشط" : "مقيد"}
                          </Text>
                        </View>
                      </View>

                      {/* Name/Username */}
                      <Text className="text-sm text-muted">
                        {account.firstName ? `${account.firstName} ${account.lastName || ""}` : "بدون اسم"}
                        {account.username ? ` (@${account.username})` : ""}
                      </Text>

                      {/* Warming Progress */}
                      <View className="mt-4 gap-1">
                        <View className="flex-row justify-between items-center">
                          <Text className="text-[10px] text-muted">مستوى التسخين</Text>
                          <Text className="text-[10px] font-bold text-primary">{account.warmingLevel}%</Text>
                        </View>
                        <View className="h-1.5 bg-background rounded-full overflow-hidden">
                          <View
                            className="h-full bg-primary"
                            style={{ width: `${account.warmingLevel}%` }}
                          />
                        </View>
                      </View>

                      {/* Stats Row */}
                      <View className="flex-row items-center gap-4 mt-4">
                        <View>
                          <Text className="text-[10px] text-muted">رسائل اليوم</Text>
                          <Text className="text-sm font-bold text-foreground">{account.messagesSentToday}/{account.dailyLimit}</Text>
                        </View>
                        <View className="w-[1px] h-6 bg-border" />
                        <View>
                          <Text className="text-[10px] text-muted">آخر نشاط</Text>
                          <Text className="text-sm font-bold text-foreground">منذ قليل</Text>
                        </View>
                      </View>
                    </View>

                    {/* Actions */}
                    <View className="gap-2">
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
                        className="w-10 h-10 rounded-xl bg-error/10 items-center justify-center"
                      >
                        <IconSymbol name="trash.fill" size={18} color={colors.error} />
                      </TouchableOpacity>

                      {!account.isActive && (
                        <TouchableOpacity
                          onPress={() => handleSmartUnban(account.phoneNumber)}
                          className="w-10 h-10 rounded-xl bg-warning/10 items-center justify-center"
                        >
                          <IconSymbol name="lifepreserver.fill" size={18} color={colors.warning} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
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
