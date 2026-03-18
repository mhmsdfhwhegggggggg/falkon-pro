import { ScrollView, View, Text, Pressable, Switch, Alert, ActivityIndicator, TouchableOpacity } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Auth from "@/lib/_core/auth";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";

/**
 * Settings Screen - Control Center Edition
 * 
 * Centralized configuration for Anti-Ban, Proxy, and UI preferences.
 * Designed for ease of use and professional control.
 */
export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [antiBanEnabled, setAntiBanEnabled] = useState(true);
  const [proxyRotation, setProxyRotation] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [rateLimitLevel, setRateLimitLevel] = useState("medium");

  const logoutMutation = trpc.auth.logout.useMutation();

  const handleLogout = () => {
    Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج من التطبيق؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تسجيل الخروج",
        style: "destructive",
        onPress: () => logoutMutation.mutate(undefined, {
          onSuccess: async () => {
            await Auth.clearSession();
            router.replace("/(auth)/login");
          },
          onError: (error: any) => {
            Alert.alert("خطأ", error.message || "فشل تسجيل الخروج");
          }
        }),
      },
    ]);
  };

  const SettingSection = ({ title, icon, children }: any) => (
    <View className="gap-3 mb-6">
      <View className="flex-row items-center gap-2 px-1">
        <IconSymbol name={icon} size={18} color={colors.primary} />
        <Text className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</Text>
      </View>
      <View className="bg-surface rounded-2xl border border-border overflow-hidden">
        {children}
      </View>
    </View>
  );

  const SettingItem = ({ label, description, icon, children, isLast }: any) => (
    <View className={`flex-row items-center justify-between p-4 ${!isLast ? 'border-b border-border' : ''}`}>
      <View className="flex-row items-center gap-3 flex-1">
        {icon && <IconSymbol name={icon} size={20} color={colors.muted} />}
        <View className="flex-1">
          <Text className="text-base font-medium text-foreground">{label}</Text>
          {description && <Text className="text-xs text-muted mt-0.5">{description}</Text>}
        </View>
      </View>
      {children}
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-6 gap-2">
          {/* Header */}
          <View className="mb-6">
            <Text className="text-3xl font-bold text-foreground">الإعدادات</Text>
            <Text className="text-sm text-muted mt-1">تحكم في أداء وأمان نظام Dragaan</Text>
          </View>

          {/* Security & Protection */}
          <SettingSection title="الأمان والحماية" icon="shield.fill">
            <SettingItem
              label="نظام Anti-Ban"
              description="حماية ذكية تمنع حظر الحسابات"
              icon="lock.shield.fill"
            >
              <Switch value={antiBanEnabled} onValueChange={setAntiBanEnabled} trackColor={{ true: colors.primary }} />
            </SettingItem>

            <SettingItem
              label="تدوير البروكسي"
              description="تبديل تلقائي للبروكسيات عند الفشل"
              icon="network"
            >
              <Switch value={proxyRotation} onValueChange={setProxyRotation} trackColor={{ true: colors.primary }} />
            </SettingItem>

            <View className="p-4">
              <Text className="text-sm font-medium text-foreground mb-3">مستوى ضغط العمليات</Text>
              <View className="flex-row gap-2">
                {[
                  { id: "low", label: "آمن جداً" },
                  { id: "medium", label: "متوازن" },
                  { id: "high", label: "أقصى سرعة" }
                ].map((level: any, index: number) => (
                  <TouchableOpacity
                    key={level.id}
                    onPress={() => setRateLimitLevel(level.id)}
                    className={`flex-1 py-3 rounded-xl border items-center ${rateLimitLevel === level.id ? 'bg-primary border-primary' : 'bg-background border-border'}`}
                  >
                    <Text className={`text-xs font-bold ${rateLimitLevel === level.id ? 'text-white' : 'text-muted'}`}>
                      {level.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </SettingSection>

          {/* Appearance & UI */}
          <SettingSection title="المظهر والواجهة" icon="paintbrush.fill">
            <SettingItem
              label="الوضع الليلي"
              description="تغيير مظهر التطبيق للوضع الداكن"
              icon="moon.fill"
            >
              <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ true: colors.primary }} />
            </SettingItem>

            <SettingItem
              label="لغة التطبيق"
              description="العربية (AR)"
              icon="globe"
              isLast
            >
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </SettingItem>
          </SettingSection>

          {/* Account & Support */}
          <SettingSection title="الحساب والدعم" icon="person.fill">
            <SettingItem
              label="معلومات الاشتراك"
              description="خطة Pro - صالحة لـ 30 يوم"
              icon="star.fill"
            />
            <SettingItem
              label="الدعم الفني"
              description="تواصل معنا عبر Telegram"
              icon="questionmark.circle.fill"
              isLast
            />
          </SettingSection>

          {/* Danger Zone */}
          <TouchableOpacity
            onPress={handleLogout}
            disabled={logoutMutation.isPending}
            className="bg-error/10 border border-error/20 rounded-2xl p-4 flex-row items-center justify-center gap-2 active:opacity-70"
          >
            {logoutMutation.isPending ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color={colors.error} />
            )}
            <Text className="text-error font-bold text-lg">تسجيل الخروج</Text>
          </TouchableOpacity>

          {/* Version Info */}
          <View className="items-center py-8">
            <Text className="text-xs text-muted">Dragaan Pro v1.0.0 (Build 20260207)</Text>
            <Text className="text-[10px] text-muted mt-1">© 2026 Dragaan Systems. All rights reserved.</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
