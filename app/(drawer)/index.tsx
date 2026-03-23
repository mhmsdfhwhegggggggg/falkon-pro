import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { GlassCard } from "@/components/ui/glass-card";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";

/**
 * Home Screen - Dragaan Pro Dashboard
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchActivities()]);
    setRefreshing(false);
  }, [refetchStats, refetchActivities]);

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
                Dragaan Pro
              </Text>
              <Text className="text-sm text-muted">
                نظام إدارة Telegram المتكامل
              </Text>
            </View>
            <Image
              source={require("@/assets/images/icon.png")}
              className="animate-float"
              style={{ width: 70, height: 70, borderRadius: 20 }}
            />
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
                <GlassCard className="flex-1 min-w-[45%]" delay={100}>
                  <View className="flex-row items-center gap-2 mb-2">
                    <View className="w-8 h-8 rounded-full items-center justify-center bg-primary/10">
                      <IconSymbol name="person.2.fill" size={16} color={colors.primary} />
                    </View>
                    <Text className="text-xs text-muted">الحسابات</Text>
                  </View>
                  <Text className="text-2xl font-bold text-foreground">
                    {stats.totalAccounts}
                  </Text>
                </GlassCard>

                {/* Active Accounts */}
                <GlassCard className="flex-1 min-w-[45%]" delay={200} variant="success">
                  <View className="flex-row items-center gap-2 mb-2">
                    <View className="w-8 h-8 rounded-full items-center justify-center bg-success/20">
                      <IconSymbol name="checkmark.circle.fill" size={16} color={colors.success} />
                    </View>
                    <Text className="text-xs text-muted">نشطة</Text>
                  </View>
                  <Text className="text-2xl font-bold text-success">
                    {stats.activeAccounts}
                  </Text>
                </GlassCard>

                {/* Members Extracted */}
                <GlassCard className="flex-1 min-w-[45%]" delay={300} variant="neon">
                  <View className="flex-row items-center gap-2 mb-2">
                    <View className="w-8 h-8 rounded-full items-center justify-center bg-warning/20">
                      <IconSymbol name="arrow.down.doc.fill" size={16} color={colors.warning} />
                    </View>
                    <Text className="text-xs text-muted">مستخرجين</Text>
                  </View>
                  <Text className="text-2xl font-bold text-foreground">
                    {stats.membersExtracted > 1000 ? `${(stats.membersExtracted / 1000).toFixed(1)}K` : stats.membersExtracted}
                  </Text>
                </GlassCard>

                {/* Messages Today */}
                <GlassCard className="flex-1 min-w-[45%]" delay={400}>
                  <View className="flex-row items-center gap-2 mb-2">
                    <View className="w-8 h-8 rounded-full items-center justify-center bg-error/20">
                      <IconSymbol name="paperplane.fill" size={16} color={colors.error} />
                    </View>
                    <Text className="text-xs text-muted">رسائل اليوم</Text>
                  </View>
                  <Text className="text-2xl font-bold text-foreground">
                    {stats.messagesToday}
                  </Text>
                </GlassCard>
              </View>
            </View>
          )}

          {/* Quick Actions */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">
              الوصول السريع
            </Text>

            <View className="gap-4">
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={action.id}
                  onPress={() => router.push(action.route as any)}
                  activeOpacity={0.7}
                >
                  <GlassCard 
                    delay={600 + (index * 100)} 
                    className="p-4 border-l-4" 
                    style={{ borderLeftColor: action.color }}
                  >
                    <View className="flex-row items-center gap-4">
                      <View
                        className="w-12 h-12 rounded-2xl items-center justify-center"
                        style={{ backgroundColor: action.color + "15" }}
                      >
                        <IconSymbol
                          name={action.icon}
                          size={24}
                          color={action.color}
                        />
                      </View>

                      <View className="flex-1">
                        <Text className="text-base font-bold text-foreground">
                          {action.title}
                        </Text>
                        <Text className="text-xs text-muted mt-0.5">
                          {action.subtitle}
                        </Text>
                      </View>

                      <IconSymbol
                        name="chevron.right"
                        size={18}
                        color={colors.muted}
                      />
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recent Activity */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">
              النشاطات الأخيرة
            </Text>

            <GlassCard delay={500} className="p-0">
              {activitiesData && activitiesData.length > 0 ? (
                (activitiesData as any[]).map((activity: any, index: number) => (
                  <View
                    key={index}
                    className={`p-4 flex-row items-center justify-between ${index < activitiesData.length - 1 ? "border-b border-border/50" : ""
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
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{
                        backgroundColor:
                          activity.status === "success"
                            ? colors.success
                            : colors.error,
                        shadowColor: activity.status === "success" ? colors.success : colors.error,
                      }}
                    />
                  </View>
                ))
              ) : (
                <View className="p-8 items-center">
                  <Text className="text-muted">لا توجد نشاطات مؤخراً</Text>
                </View>
              )}
            </GlassCard>
          </View>

          {/* System Status */}
          <GlassCard variant="neon" className="p-4 gap-2 animate-pulse-soft">
            <Text className="text-sm font-bold text-primary">
              🛡️ حماية Anti-Ban: نشطة
            </Text>
            <Text className="text-xs text-foreground/80 leading-relaxed font-medium">
              النظام يراقب الحسابات حالياً ويقوم بتعديل التأخير تلقائياً بناءً على سجل النشاط لضمان استمرارية العمل 24/7.
            </Text>
          </GlassCard>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
