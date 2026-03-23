import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { GlassCard } from "@/components/ui/glass-card";
import { LocalTelegramService } from "@/lib/LocalTelegramService";
import { localSessionStore } from "@/lib/local-session-store";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function AddAccountLocalScreen() {
  const colors = useColors();
  const router = useRouter();
  
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  
  const [step, setStep] = useState<"phone" | "code" | "password">("phone");
  const [isLoading, setIsLoading] = useState(false);

  const addAccountMutation = trpc.accounts.add.useMutation();

  const handleSendCode = async () => {
    if (!phoneNumber) return Alert.alert("خطأ", "الرجاء إدخال رقم الهاتف");
    
    setIsLoading(true);
    try {
      // Re-initialize a fresh client for this login attempt
      const client = new LocalTelegramService();
      await client.init(); // start with empty session
      
      const hash = await client.sendCode(phoneNumber);
      setPhoneCodeHash(hash);
      setStep("code");
    } catch (error: any) {
      Alert.alert("فشل إرسال الكود", error.message || String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!code) return Alert.alert("خطأ", "الرجاء إدخال رمز التحقق");
    
    setIsLoading(true);
    try {
      const client = new LocalTelegramService();
      
      // 1. Get the session string natively
      let sessionString = "";
      try {
         sessionString = await client.signIn(phoneNumber, phoneCodeHash, code, password || undefined) as string;
      } catch (e: any) {
        if (e.message?.includes("SESSION_PASSWORD_NEEDED")) {
          setStep("password");
          setIsLoading(false);
          return;
        }
        throw e;
      }
      
      // 2. Register to DB (Without sending the session string to keep it Zero-Knowledge!)
      addAccountMutation.mutate({
        phoneNumber,
        sessionString: undefined, // Enforcing Zero-Knowledge DB
      }, {
        onSuccess: async (dbAccount: any) => {
          // 3. Save session locally securely tied to this account ID
          await localSessionStore.saveAccountSession(dbAccount.id, sessionString);
          
          Alert.alert("نجاح", "تم تسجيل الدخول وتخزين الجلسة محلياً بأمان!", [
            { text: "موافق", onPress: () => router.push("/(drawer)/accounts") }
          ]);
        },
        onError: (err: any) => {
          Alert.alert("خطأ", "حدث خطأ أثناء تسجيل الحساب في قاعدة البيانات: " + err.message);
        }
      });
      
    } catch (error: any) {
      Alert.alert("فشل تسجيل الدخول", error.message || String(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}>
        <GlassCard className="p-6 gap-6">
          <View className="items-center pb-4">
            <View className="w-16 h-16 rounded-full bg-primary/20 items-center justify-center mb-4">
              <IconSymbol name="lock.shield" size={32} color={colors.primary} />
            </View>
            <Text className="text-2xl font-black text-foreground">دخول آمن (محلي)</Text>
            <Text className="text-sm text-muted text-center mt-2">
              سيتم تخزين الجلسة على هذا الجهاز فقط ولن يتم إرسالها إلى خوادمنا. (Zero-Knowledge)
            </Text>
          </View>

          {step === "phone" && (
            <View className="gap-4">
              <View className="gap-2">
                <Text className="text-sm font-bold text-foreground">رقم الهاتف (مع رمز الدولة)</Text>
                <TextInput
                  className="bg-zinc-100/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-border text-foreground font-mono"
                  placeholder="+966500000000"
                  placeholderTextColor={colors.muted}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                />
              </View>
              <TouchableOpacity
                onPress={handleSendCode}
                disabled={isLoading}
                className="bg-primary h-14 rounded-xl items-center justify-center"
              >
                {isLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">إرسال الرمز</Text>}
              </TouchableOpacity>
            </View>
          )}

          {(step === "code" || step === "password") && (
            <View className="gap-4">
              <View className="gap-2">
                <Text className="text-sm font-bold text-foreground">رمز التحقق</Text>
                <TextInput
                  className="bg-zinc-100/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-border text-foreground font-mono"
                  placeholder="12345"
                  placeholderTextColor={colors.muted}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  editable={step === "code"}
                />
              </View>

              {step === "password" && (
                <View className="gap-2 mt-2">
                  <Text className="text-sm font-bold text-foreground">كلمة المرور (التحقق بخطوتين)</Text>
                  <TextInput
                    className="bg-zinc-100/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-border text-foreground font-mono"
                    placeholder="أدخل كلمة المرور"
                    placeholderTextColor={colors.muted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
              )}

              <TouchableOpacity
                onPress={handleSignIn}
                disabled={isLoading}
                className="bg-primary h-14 rounded-xl items-center justify-center mt-2"
              >
                {isLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">تأكيد الدخول</Text>}
              </TouchableOpacity>
            </View>
          )}
        </GlassCard>
      </ScrollView>
    </ScreenContainer>
  );
}
