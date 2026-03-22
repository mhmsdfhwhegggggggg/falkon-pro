import { ScrollView, View, Text, Pressable, ActivityIndicator } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { IconSymbol } from "@/components/ui/icon-symbol";

const trpcAny = trpc as any;

export default function StatsScreen() {
  const colors = useColors();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  // Fetch accounts for selection
  const { data: accounts, isLoading: loadingAccounts } = (trpcAny.accounts.getAll.useQuery() as any);

  // Fetch stats for selected account
  const { data: statsData, isLoading: loadingStats } = (trpcAny.stats.getDailyStats.useQuery(
    { accountId: selectedAccountId || 0, date: new Date().toISOString().split("T")[0] },
    { enabled: !!selectedAccountId }
  ) as any);

  // Fetch activity logs
  const { data: logsData, isLoading: loadingLogs } = (trpcAny.stats.getActivityLogs.useQuery(
    { accountId: selectedAccountId || 0, limit: 10 },
    { enabled: !!selectedAccountId }
  ) as any);

  const stats = statsData?.stats;
  const logs = logsData?.logs || [];

  const metrics = [
    { label: "الرسائل المرسلة", value: stats?.messagesSent || 0, color: colors.primary },
    { label: "الرسائل الفاشلة", value: stats?.messagesFailed || 0, color: colors.error },
    { label: "الأعضاء المستخرجين", value: stats?.membersExtracted || 0, color: colors.success },
    { label: "الجروبات المنضم إليها", value: stats?.groupsJoined || 0, color: colors.warning },
  ];

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-4 gap-4">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">الإحصائيات</Text>
            <Text className="text-sm text-muted">تحليل الأداء والنشاطات</Text>
          </View>

          {/* Account Selection */}
          <View className="gap-3 bg-surface rounded-lg p-4">
            <Text className="text-sm font-semibold text-foreground">اختر الحساب</Text>
            {loadingAccounts ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                {accounts?.map((account: any) => (
                  <Pressable
                    key={account.id}
                    onPress={() => setSelectedAccountId(account.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: selectedAccountId === account.id ? colors.primary : colors.border,
                      backgroundColor: selectedAccountId === account.id ? colors.primary + "10" : colors.background,
                    }}
                  >
                    <Text style={{ color: selectedAccountId === account.id ? colors.primary : colors.foreground }}>
                      {account.firstName || account.phoneNumber}
                    </Text>
                  </Pressable>
                ))}
                {accounts?.length === 0 && (
                  <Text className="text-muted italic">لا توجد حسابات مضافة</Text>
                )}
              </ScrollView>
            )}
          </View>

          {!selectedAccountId ? (
            <View className="bg-surface rounded-lg p-8 items-center justify-center">
              <Text className="text-muted text-center">يرجى اختيار حساب لعرض الإحصائيات</Text>
            </View>
          ) : loadingStats ? (
            <ActivityIndicator size="large" color={colors.primary} className="my-8" />
          ) : (
            <>
              {/* Key Metrics */}
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">المقاييس الرئيسية (اليوم)</Text>
                <View className="gap-2">
                  {metrics.map((metric, i) => (
                    <View key={i} className="bg-surface rounded-lg p-3 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3 flex-1">
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: metric.color,
                          }}
                        />
                        <View className="flex-1">
                          <Text className="text-xs text-muted">{metric.label}</Text>
                          <Text className="text-lg font-bold text-foreground">{metric.value.toLocaleString()}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Performance Indicators */}
              <View className="bg-surface rounded-lg p-4 gap-4">
                <Text className="text-sm font-semibold text-foreground">مؤشرات الأداء</Text>

                {/* Success Rate */}
                <View className="gap-2">
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted">معدل النجاح</Text>
                    <Text className="text-xs font-bold text-success">{stats?.successRate || 0}%</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" }}>
                    <View style={{ height: "100%", width: `${stats?.successRate || 0}%`, backgroundColor: colors.success }} />
                  </View>
                </View>

                {/* Daily Limit Usage */}
                <View className="gap-2">
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted">استخدام الحد اليومي</Text>
                    <Text className="text-xs font-bold text-primary">
                      {stats?.accountStatus?.messagesSentToday || 0}/{stats?.accountStatus?.dailyLimit || 100}
                    </Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" }}>
                    <View
                      style={{
                        height: "100%",
                        width: `${Math.min(100, ((stats?.accountStatus?.messagesSentToday || 0) / (stats?.accountStatus?.dailyLimit || 100)) * 100)}%`,
                        backgroundColor: colors.primary
                      }}
                    />
                  </View>
                </View>
              </View>

              {/* Activity Timeline */}
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">سجل النشاطات الأخير</Text>
                <View className="bg-surface rounded-lg overflow-hidden">
                  {loadingLogs ? (
                    <ActivityIndicator color={colors.primary} className="p-4" />
                  ) : logs.length > 0 ? (
                    logs.map((log: any, i: number) => (
                      <View
                        key={log.id}
                        className={`p - 3 flex - row items - center justify - between ${i < logs.length - 1 ? "border-b" : ""} `}
                        style={{ borderBottomColor: colors.border, borderBottomWidth: i < logs.length - 1 ? 1 : 0 }}
                      >
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-foreground">{log.action}</Text>
                          <Text className="text-xs text-muted mt-1">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </Text>
                        </View>
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: log.status === "success" ? colors.success : colors.error,
                          }}
                        />
                      </View>
                    ))
                  ) : (
                    <Text className="p-4 text-center text-muted">لا توجد نشاطات مسجلة</Text>
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
