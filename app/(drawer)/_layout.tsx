import { Drawer } from "expo-router/drawer";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

export default function DrawerLayout() {
  const colors = useColors();
  const { data: isAdmin } = trpc.auth.isAdmin.useQuery(undefined);

  return (
    <Drawer
      screenOptions={{
        headerShown: true,
        drawerActiveTintColor: colors.primary,
        drawerActiveBackgroundColor: colors.primary + '18',
        drawerInactiveTintColor: colors.muted,
        drawerItemStyle: {
            borderRadius: 16,
            marginHorizontal: 12,
            marginVertical: 4,
        },
        drawerLabelStyle: {
            fontFamily: 'Outfit-Medium', // Assuming this font is loaded
            fontSize: 15,
        },
        drawerStyle: {
          backgroundColor: colors.background,
          width: 300,
          borderRightWidth: 1,
          borderRightColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
            fontFamily: 'Outfit-Bold',
            fontSize: 18,
        },
        headerTintColor: colors.text,
        headerTitleAlign: "center",
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          drawerLabel: "الرئيسية",
          title: "لوحة القيادة",
          drawerIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Drawer.Screen
        name="accounts"
        options={{
          drawerLabel: "إدارة الحسابات",
          title: "الحسابات النشطة",
          drawerIcon: ({ color }) => <IconSymbol size={24} name="person.2.fill" color={color} />,
        }}
      />
      <Drawer.Screen
        name="extraction"
        options={{
          drawerLabel: "الاستخراج الذكي",
          title: "سحب البيانات",
          drawerIcon: ({ color }) => <IconSymbol size={24} name="arrow.down.doc.fill" color={color} />,
        }}
      />
      <Drawer.Screen
        name="extract-and-add"
        options={{
          drawerLabel: "استخراج + إضافة",
          title: "النقل المباشر",
          drawerIcon: ({ color }) => <IconSymbol size={24} name="arrow.up.arrow.down" color={color} />,
        }}
      />
      <Drawer.Screen
        name="bulk-ops"
        options={{
          drawerLabel: "عمليات مجمعة",
          title: "التشغيل المجمع",
          drawerIcon: ({ color }) => <IconSymbol size={24} name="square.stack.fill" color={color} />,
        }}
      />
      <Drawer.Screen
        name="channel-management"
        options={{
          drawerLabel: "إدارة القنوات",
          title: "أدوات القنوات",
          drawerIcon: ({ color }) => <IconSymbol size={24} name="list.bullet" color={color} />,
        }}
      />
      <Drawer.Screen
        name="content-cloner"
        options={{
          drawerLabel: "نسخ المحتوى",
          title: "تكسير ونسخ",
          drawerIcon: ({ color }) => <IconSymbol size={24} name="doc.on.doc.fill" color={color} />,
        }}
      />
      <Drawer.Screen
        name="auto-reply"
        options={{
          drawerLabel: "الرد التلقائي",
          title: "البوتات والردود",
          drawerIcon: ({ color }) => <IconSymbol size={24} name="bubble.left.bubble" color={color} />,
        }}
      />
      <Drawer.Screen
        name="proxies"
        options={{
          drawerLabel: "إعدادات البروكسي",
          title: "شبكة البروكسي",
          drawerIcon: ({ color }) => <IconSymbol size={24} name="network" color={color} />,
        }}
      />
      <Drawer.Screen
        name="stats"
        options={{
          drawerLabel: "الإحصائيات",
          title: "تحليلات الأداء",
          drawerIcon: ({ color }) => <IconSymbol size={24} name="chart.bar.fill" color={color} />,
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          drawerLabel: "الإعدادات",
          title: "إعدادات التطبيق",
          drawerIcon: ({ color }) => <IconSymbol size={24} name="gearshape.fill" color={color} />,
        }}
      />
      <Drawer.Screen
        name="license-dashboard"
        options={{
          drawerLabel: "لوحة المطور",
          title: "إدارة النظام (Admin)",
          drawerIcon: ({ color }) => <IconSymbol size={24} name="lock.shield.fill" color={color} />,
          drawerItemStyle: { display: isAdmin ? 'flex' : 'none' },
        }}
      />
      
      {/* Hidden Screens */}
      <Drawer.Screen name="onboarding" options={{ drawerItemStyle: { display: 'none' }, title: "تسجيل الدخول", headerShown: false }} />
      <Drawer.Screen name="analytics" options={{ drawerItemStyle: { display: 'none' }, title: "التحليلات" }} />
    </Drawer>
  );
}
