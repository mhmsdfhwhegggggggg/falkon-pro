import { useState, useMemo } from "react";
import { ScrollView, View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

export default function ProxiesScreen() {
  const colors = useColors();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [csvText, setCsvText] = useState("");

  const { data: accounts, isLoading: loadingAccounts } = trpc.accounts.getAll.useQuery(undefined);
  const listQuery = trpc.proxies.listProxies.useQuery(
    { accountId: selectedAccountId || 0 },
    { enabled: !!selectedAccountId, refetchInterval: 5000 }
  );

  const importMutation = trpc.proxies.importProxies.useMutation();

  const disableImport = useMemo(() => {
    const hasCsv = csvText.trim().length > 0;
    const hasJson = jsonText.trim().length > 0;
    return !selectedAccountId || (!hasCsv && !hasJson);
  }, [selectedAccountId, csvText, jsonText]);

  const handleImport = () => {
    if (!selectedAccountId) return Alert.alert("تنبيه", "يرجى اختيار حساب أولاً");
    let parsedItems: any[] | undefined = undefined;
    if (jsonText.trim()) {
      try {
        const arr = JSON.parse(jsonText);
        if (!Array.isArray(arr)) throw new Error("JSON يجب أن يكون مصفوفة");
        parsedItems = arr;
      } catch (e: any) {
        return Alert.alert("خطأ JSON", e?.message || "صيغة JSON غير صحيحة");
      }
    }
    importMutation.mutate(
      { accountId: selectedAccountId, items: parsedItems, csvText: csvText.trim() || undefined },
      {
        onSuccess: (res: any) => {
          Alert.alert("تم", `تم استيراد ${res.inserted} بروكسي بنجاح`);
          listQuery.refetch();
        },
        onError: (err: any) => {
          Alert.alert("خطأ", err.message || "فشل استيراد البروكسيات");
        },
      }
    );
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-4 gap-4">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">إدارة البروكسي</Text>
            <Text className="text-sm text-muted">استيراد وعرض بروكسيات لكل حساب</Text>
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
                {accounts?.length === 0 && <Text className="text-muted italic">لا توجد حسابات مضافة</Text>}
              </ScrollView>
            )}
          </View>

          {/* Import Section */}
          <View className="bg-surface rounded-lg p-4 gap-3">
            <Text className="text-sm font-semibold text-foreground">استيراد (CSV أو JSON)</Text>

            <View className="gap-2">
              <Text className="text-xs text-muted">CSV: host,port,type,username,password</Text>
              <TextInput
                multiline
                numberOfLines={6}
                placeholder="مثال:\n1.2.3.4,1080,socks5,user,pass\nproxy.com,8080,http,,"
                value={csvText}
                onChangeText={setCsvText}
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
            </View>

            <View className="gap-2">
              <Text className="text-xs text-muted">أو JSON (مصفوفة عناصر)</Text>
              <TextInput
                multiline
                numberOfLines={6}
                placeholder='[ {"host":"1.2.3.4","port":1080,"type":"socks5","username":"u","password":"p"} ]'
                value={jsonText}
                onChangeText={setJsonText}
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
            </View>

            <Pressable
              onPress={handleImport}
              disabled={disableImport || importMutation.isPending}
              style={{
                backgroundColor: disableImport || importMutation.isPending ? colors.muted : colors.primary,
                paddingVertical: 12,
                borderRadius: 8,
                opacity: disableImport || importMutation.isPending ? 0.6 : 1,
              }}
            >
              <View className="flex-row items-center justify-center gap-2">
                {importMutation.isPending && <ActivityIndicator color="white" />}
                <Text className="text-white font-semibold text-center">استيراد</Text>
              </View>
            </Pressable>
          </View>

          {/* List Section */}
          <View className="bg-surface rounded-lg p-4 gap-3">
            <Text className="text-sm font-semibold text-foreground">القائمة</Text>
            {!selectedAccountId ? (
              <Text className="text-muted">اختر حساباً لعرض البروكسيات</Text>
            ) : listQuery.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <View className="gap-2">
                {listQuery.data?.proxies?.length ? (
                  listQuery.data.proxies.map((p: any) => (
                    <View key={`${p.host}:${p.port}:${p.username || ""} `} className="border border-border rounded-lg p-3">
                      <Text className="text-foreground text-sm">{p.type?.toUpperCase()} • {p.host}:{p.port}</Text>
                      {p.username && <Text className="text-muted text-xs">{p.username}</Text>}
                      <Text className="text-muted text-xs">الحالة: {p.health || "unknown"}</Text>
                    </View>
                  ))
                ) : (
                  <Text className="text-muted">لا توجد بروكسيات لهذا الحساب</Text>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
