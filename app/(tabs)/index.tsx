import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";

/**
 * Home Screen - FALKON PRO Pro Dashboard
 * 
 * Displays system overview, statistics, and quick actions for all major features.
 * Optimized for high performance and modern look.
 */
export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch dashboard stats from API
  const { data: statsData, isLoading, refetch: refetchStats } = trpc.dashboard.getStats.useQuery(undefined);
  const { data: activitiesData, refetch: refetchActivities } = trpc.dashboard.getRecentActivities.useQuery(undefined);
  const { data: licenseData, refetch: refetchLicense } = trpc.license.getUserLicenses.useQuery({});

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchActivities(), refetchLicense()]);
    setRefreshing(false);
  }, [refetchStats, refetchActivities, refetchLicense]);

  const activeLicense = licenseData?.licenses?.find((l: any) => l.status === 'active');

  const stats = statsData || {
    totalAccounts: 0,
    activeAccounts: 0,
    membersExtracted: 0,
    messagesToday: 0,
  };

  const quickActions = [
    {
      id: "extract-and-add",
      title: "استخراج + إضافة",
      subtitle: "العملية المتكاملة 24/7",
      icon: "arrow.up.arrow.down" as const,
      color: colors.primary,
      route: "/extract-and-add",
    },
    {
      id: "accounts",
      title: "إدارة الحسابات",
      subtitle: "فك الحظر والتسخين",
      icon: "person.2.fill" as const,
      color: colors.success,
      route: "/accounts",
    },
    {
      id: "extraction",
      title: "استخراج متقدم",
      subtitle: "فلاتر ذكية وشاملة",
      icon: "arrow.down.doc.fill" as const,
      color: colors.warning,
      route: "/extraction",
    },
    {
      id: "bulk-ops",
      title: "العمليات الضخمة",
      subtitle: "إرسال رسائل وانضمام",
      icon: "square.stack.fill" as const,
      color: colors.error,
      route: "/bulk-ops",
    },
  ];

  return (
    <ScreenContainer className="bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View className="p-6 gap-6">
          {/* Header with Logo */}
          <View className="flex-row items-center justify-between">
            <View className="gap-1">
              <Text className="text-3xl font-bold text-foreground">
                FALKON PRO
              </Text>
              <Text className="text-sm text-muted">
                نظام إدارة Telegram المتكامل
              </Text>
            </View>
            <Image
              source={require("@/assets/images/icon.png")}
              style={{ width: 60, height: 60, borderRadius: 15 }}
            />
          </View>

          {/* Membership Card */}
          <View className="bg-surface rounded-3xl p-6 border border-border shadow-sm overflow-hidden">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-muted text-xs uppercase tracking-widest font-bold">حالة الاشتراك</Text>
                <Text className="text-foreground text-xl font-bold mt-1">
                  {activeLicense ? (activeLicense.type === 'premium' ? 'نسخة بريميوم ✨' : 'نسخة مفعلة ✅') : 'لا يوجد ترخيص نشط ❌'}
                </Text>
              </View>
              <View className="bg-primary/20 p-2 rounded-xl">
                <IconSymbol name="shield.fill" size={24} color={colors.primary} />
              </View>
            </View>
            
            <View className="h-0.5 bg-border/50 w-full mb-4" />
            
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-muted text-xs mb-1">تاريخ الانتهاء</Text>
                <Text className="text-foreground font-medium">
                  {activeLicense?.expiresAt ? new Date(activeLicense.expiresAt).toLocaleDateString('ar-SA') : '---'}
                </Text>
              </View>
              {activeLicense && (
                <View className="bg-success/20 px-3 py-1 rounded-full border border-success/30">
                  <Text className="text-success text-xs font-bold">عضوية نشطة</Text>
                </View>
              )}
            </View>
          </View>

          {/* Statistics Section */}
          {isLoading ? (
            <View className="items-center justify-center py-8">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                نظرة عامة
              </Text>

              {/* Stats Grid */}
              <View className="flex-row flex-wrap gap-3">
                {/* Total Accounts */}
                <View className="flex-1 min-w-[45%] bg-surface rounded-2xl p-4 border border-border">
                  <View className="flex-row items-center gap-2 mb-2">
                    <View className="w-8 h-8 rounded-full items-center justify-center bg-primary/10">
                      <IconSymbol name="person.2.fill" size={16} color={colors.primary} />
                    </View>
                    <Text className="text-xs text-muted">الحسابات</Text>
                  </View>
                  <Text className="text-2xl font-bold text-foreground">
                    {stats.totalAccounts}
                  </Text>
                </View>

                {/* Active Accounts */}
                <View className="flex-1 min-w-[45%] bg-surface rounded-2xl p-4 border border-border">
                  <View className="flex-row items-center gap-2 mb-2">
                    <View className="w-8 h-8 rounded-full items-center justify-center bg-success/10">
                      <IconSymbol name="checkmark.circle.fill" size={16} color={colors.success} />
                    </View>
                    <Text className="text-xs text-muted">نشطة</Text>
                  </View>
                  <Text className="text-2xl font-bold text-success">
                    {stats.activeAccounts}
                  </Text>
                </View>

                {/* Members Extracted */}
                <View className="flex-1 min-w-[45%] bg-surface rounded-2xl p-4 border border-border">
                  <View className="flex-row items-center gap-2 mb-2">
                    <View className="w-8 h-8 rounded-full items-center justify-center bg-warning/10">
                      <IconSymbol name="arrow.down.doc.fill" size={16} color={colors.warning} />
                    </View>
                    <Text className="text-xs text-muted">مستخرجين</Text>
                  </View>
                  <Text className="text-2xl font-bold text-foreground">
                    {stats.membersExtracted > 1000 ? `${(stats.membersExtracted / 1000).toFixed(1)}K` : stats.membersExtracted}
                  </Text>
                </View>

                {/* Messages Today */}
                <View className="flex-1 min-w-[45%] bg-surface rounded-2xl p-4 border border-border">
                  <View className="flex-row items-center gap-2 mb-2">
                    <View className="w-8 h-8 rounded-full items-center justify-center bg-error/10">
                      <IconSymbol name="paperplane.fill" size={16} color={colors.error} />
                    </View>
                    <Text className="text-xs text-muted">رسائل اليوم</Text>
                  </View>
                  <Text className="text-2xl font-bold text-foreground">
                    {stats.messagesToday}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Quick Actions */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">
              الوصول السريع
            </Text>

            <View className="gap-2">
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  onPress={() => router.push(action.route as any)}
                  className="bg-surface rounded-2xl p-4 border border-border active:opacity-70"
                  style={{ borderLeftWidth: 4, borderLeftColor: action.color }}
                >
                  <View className="flex-row items-center gap-4">
                    <View
                      className="w-12 h-12 rounded-full items-center justify-center"
                      style={{ backgroundColor: action.color + "15" }}
                    >
                      <IconSymbol
                        name={action.icon}
                        size={24}
                        color={action.color}
                      />
                    </View>

                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        {action.title}
                      </Text>
                      <Text className="text-sm text-muted mt-0.5">
                        {action.subtitle}
                      </Text>
                    </View>

                    <IconSymbol
                      name="chevron.right"
                      size={20}
                      color={colors.muted}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recent Activity */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">
              النشاطات الأخيرة
            </Text>

            <View className="bg-surface rounded-2xl border border-border overflow-hidden">
              {activitiesData && activitiesData.length > 0 ? (
                (activitiesData as any[]).map((activity: any, index: number) => (
                  <View
                    key={index}
                    className={`p-4 flex-row items-center justify-between ${index < activitiesData.length - 1 ? "border-b border-border" : ""
                      }`}
                  >
                    <View className="flex-1">
                      <Text className="text-base font-medium text-foreground">
                        {activity.action}
                      </Text>
                      <Text className="text-sm text-muted mt-1">
                        {activity.time}
                      </Text>
                    </View>
                    <View
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor:
                          activity.status === "success"
                            ? colors.success
                            : colors.error,
                      }}
                    />
                  </View>
                ))
              ) : (
                <View className="p-8 items-center">
                  <Text className="text-muted">لا توجد نشاطات مؤخراً</Text>
                </View>
              )}
            </View>
          </View>

          {/* System Status */}
          <View className="bg-primary/10 border border-primary/20 rounded-2xl p-4 gap-2">
            <Text className="text-sm font-semibold text-primary">
              🛡️ حماية Anti-Ban: نشطة
            </Text>
            <Text className="text-xs text-foreground leading-relaxed">
              النظام يراقب الحسابات حالياً ويقوم بتعديل التأخير تلقائياً لضمان استمرارية العمل 24/7.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

