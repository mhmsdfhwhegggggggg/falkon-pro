import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable, ActivityIndicator, Alert, Linking } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const trpcAny = trpc as any;

export default function SetupScreen() {
  const colors = useColors();
  const status = trpcAny.setup.getStatus.useQuery(undefined) as any;

  const setTelegram = trpcAny.setup.setTelegram.useMutation();
  const setDb = trpcAny.setup.setDatabase.useMutation();
  const setRedis = trpcAny.setup.setRedis.useMutation();

  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [dbUrl, setDbUrl] = useState("");
  const [redisUrl, setRedisUrl] = useState("");

  const disableTelegram = useMemo(() => !apiId || !apiHash, [apiId, apiHash]);
  const disableDb = useMemo(() => !dbUrl, [dbUrl]);
  const disableRedis = useMemo(() => !redisUrl, [redisUrl]);

  const openMyTelegram = () => Linking.openURL("https://my.telegram.org/apps");

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-4 gap-4">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">الإعداد السريع</Text>
            <Text className="text-sm text-muted">أكمل البيانات للعمل بدون مدير</Text>
          </View>

          {/* Status */}
          <View className="bg-surface rounded-lg p-4 gap-2 border border-border">
            {status.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text className="text-sm" style={{ color: colors.foreground }}>
                  Telegram: {(status.data as any)?.hasTelegram ? "جاهز" : "غير مضبوط"}
                </Text>
                <Text className="text-sm" style={{ color: colors.foreground }}>
                  تشفير الجلسات: {(status.data as any)?.hasEnc ? "جاهز" : "سيتم توليده تلقائياً"}
                </Text>
                <Text className="text-sm" style={{ color: colors.foreground }}>
                  قاعدة البيانات: {(status.data as any)?.hasDb ? "جاهزة" : "غير مضبوطة"}
                </Text>
                <Text className="text-sm" style={{ color: colors.foreground }}>
                  Redis: {(status.data as any)?.hasRedis ? "جاهزة" : "غير مضبوطة"}
                </Text>
              </>
            )}
          </View>

          {/* Telegram */}
          <View className="bg-surface rounded-lg p-4 gap-3">
            <Text className="text-sm font-semibold text-foreground">Telegram API</Text>
            <Pressable onPress={openMyTelegram}>
              <Text className="text-xs" style={{ color: colors.primary }}>فتح my.telegram.org للحصول على api_id و api_hash</Text>
            </Pressable>
            <TextInput
              placeholder="api_id"
              keyboardType="number-pad"
              value={apiId}
              onChangeText={setApiId}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.foreground, backgroundColor: colors.background }}
              placeholderTextColor={colors.muted}
            />
            <TextInput
              placeholder="api_hash"
              value={apiHash}
              onChangeText={setApiHash}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.foreground, backgroundColor: colors.background }}
              placeholderTextColor={colors.muted}
            />
            <Pressable
              onPress={() => setTelegram.mutate({ apiId: parseInt(apiId, 10), apiHash }, {
                onSuccess: () => { Alert.alert("تم", "تم حفظ بيانات Telegram بنجاح"); status.refetch(); },
                onError: (e: any) => Alert.alert("خطأ", e.message || "فشل حفظ بيانات Telegram"),
              })}
              disabled={disableTelegram || setTelegram.isPending}
              style={{ backgroundColor: disableTelegram || setTelegram.isPending ? colors.muted : colors.primary, paddingVertical: 12, borderRadius: 8, opacity: disableTelegram || setTelegram.isPending ? 0.6 : 1 }}
            >
              <View className="flex-row items-center justify-center gap-2">
                {setTelegram.isPending && <ActivityIndicator color="white" />}
                <Text className="text-white font-semibold text-center">حفظ Telegram</Text>
              </View>
            </Pressable>
          </View>

          {/* Database */}
          <View className="bg-surface rounded-lg p-4 gap-3">
            <Text className="text-sm font-semibold text-foreground">Database URL</Text>
            <TextInput
              placeholder="postgres://USER:PASSWORD@HOST:5432/DBNAME"
              value={dbUrl}
              onChangeText={setDbUrl}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.foreground, backgroundColor: colors.background }}
              placeholderTextColor={colors.muted}
            />
            <Pressable
              onPress={() => setDb.mutate({ url: dbUrl }, {
                onSuccess: () => { Alert.alert("تم", "تم حفظ Database URL"); status.refetch(); },
                onError: (e: any) => Alert.alert("خطأ", e.message || "فشل حفظ Database URL"),
              })}
              disabled={disableDb || setDb.isPending}
              style={{ backgroundColor: disableDb || setDb.isPending ? colors.muted : colors.primary, paddingVertical: 12, borderRadius: 8, opacity: disableDb || setDb.isPending ? 0.6 : 1 }}
            >
              <View className="flex-row items-center justify-center gap-2">
                {setDb.isPending && <ActivityIndicator color="white" />}
                <Text className="text-white font-semibold text-center">حفظ Database</Text>
              </View>
            </Pressable>
          </View>

          {/* Redis */}
          <View className="bg-surface rounded-lg p-4 gap-3">
            <Text className="text-sm font-semibold text-foreground">Redis URL</Text>
            <TextInput
              placeholder="redis://127.0.0.1:6379"
              value={redisUrl}
              onChangeText={setRedisUrl}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.foreground, backgroundColor: colors.background }}
              placeholderTextColor={colors.muted}
            />
            <Pressable
              onPress={() => setRedis.mutate({ url: redisUrl }, {
                onSuccess: () => { Alert.alert("تم", "تم حفظ Redis URL"); status.refetch(); },
                onError: (e: any) => Alert.alert("خطأ", e.message || "فشل حفظ Redis URL"),
              })}
              disabled={disableRedis || setRedis.isPending}
              style={{ backgroundColor: disableRedis || setRedis.isPending ? colors.muted : colors.primary, paddingVertical: 12, borderRadius: 8, opacity: disableRedis || setRedis.isPending ? 0.6 : 1 }}
            >
              <View className="flex-row items-center justify-center gap-2">
                {setRedis.isPending && <ActivityIndicator color="white" />}
                <Text className="text-white font-semibold text-center">حفظ Redis</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
