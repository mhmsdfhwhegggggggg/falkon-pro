import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useThemeContext } from '@/lib/theme-provider';

const screenWidth = Dimensions.get('window').width;

export default function AntiBanDashboardScreen() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'accounts' | 'analytics' | 'alerts'>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === 'dark';

  // tRPC queries
  const { data: systemStats, refetch: refetchSystem } = trpc.antiBan.getSystemStatistics.useQuery(undefined);
  const { data: healthData, refetch: refetchHealth } = trpc.antiBan.getAccountStatus.useQuery({ accountId: 123 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchSystem(), refetchHealth()]);
    setRefreshing(false);
  }, [refetchSystem, refetchHealth]);

  const chartConfig = {
    backgroundGradientFrom: isDark ? '#111827' : '#ffffff',
    backgroundGradientTo: isDark ? '#111827' : '#ffffff',
    color: (opacity = 1) => `rgba(124, 58, 237, ${opacity})`, // Neon Violet
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    labelColor: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
  };

  const TabButton = ({ id, label, icon }: { id: typeof selectedTab, label: string, icon: any }) => (
    <TouchableOpacity
      onPress={() => setSelectedTab(id)}
      className={`flex-1 items-center justify-center py-3 border-b-2 ${selectedTab === id ? 'border-primary' : 'border-transparent'
        }`}
    >
      <Ionicons
        name={icon}
        size={24}
        color={selectedTab === id ? '#8B5CF6' : isDark ? '#9CA3AF' : '#6B7280'}
      />
      <Text className={`text-xs mt-1 ${selectedTab === id ? 'text-primary font-bold' : 'text-muted'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const OverviewTab = () => (
    <View className="space-y-4 p-4">
      <GlassCard delay={100} variant="neon" className="mb-4">
        <Text className="text-lg font-bold text-foreground mb-4">📊 System Stats</Text>
        <View className="flex-row justify-between">
          <View className="items-center">
            <Text className="text-2xl font-bold text-primary">{systemStats?.totalAccounts || 0}</Text>
            <Text className="text-xs text-muted">Accounts</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-success">{systemStats?.healthyAccounts || 0}</Text>
            <Text className="text-xs text-muted">Healthy</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-warning">
              {systemStats?.averageSuccessRate ? (systemStats.averageSuccessRate * 100).toFixed(0) : 0}%
            </Text>
            <Text className="text-xs text-muted">Success</Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard delay={200}>
        <Text className="text-lg font-bold text-foreground mb-2">🛡️ Active Protection</Text>
        <View className="flex-row items-center justify-center my-4">
          <View className="h-24 w-24 rounded-full border-4 border-success items-center justify-center">
            <Ionicons name="shield-checkmark" size={48} color="#10B981" />
          </View>
        </View>
        <Text className="text-center text-muted">
          Falcon Shield V5 is <Text className="text-success font-bold">ACTIVE</Text>
        </Text>
        <View className="flex-row flex-wrap justify-center mt-4 gap-2">
          {['Multi-Layer', 'AI Learning', 'Real-time', 'Advanced Analytics'].map((tag, i) => (
            <View key={i} className="px-2 py-1 bg-primary/10 rounded border border-primary/20">
              <Text className="text-xs text-primary">{tag}</Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <GlassCard delay={300}>
        <Text className="text-lg font-bold text-foreground mb-4">📈 Performance</Text>
        <View className="space-y-3">
          <View className="flex-row justify-between">
            <Text className="text-muted">Avg Response</Text>
            <Text className="text-foreground font-bold">{systemStats?.averageDelay || 0}ms</Text>
          </View>
          <View className="h-2 bg-muted/20 rounded-full overflow-hidden">
            <View style={{ width: '40%' }} className="h-full bg-primary" />
          </View>

          <View className="flex-row justify-between">
            <Text className="text-muted">Risk Score</Text>
            <Text className="text-foreground font-bold">{systemStats?.averageRiskScore?.toFixed(1) || 0}/100</Text>
          </View>
          <View className="h-2 bg-muted/20 rounded-full overflow-hidden">
            <View style={{ width: `${systemStats?.averageRiskScore || 0}%` }} className="h-full bg-warning" />
          </View>
        </View>
      </GlassCard>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 py-3 border-b border-border bg-background flex-row justify-between items-center">
        <View>
          <Text className="text-2xl font-bold text-primary">FALCON</Text>
          <Text className="text-xs text-muted tracking-widest">ANTI-BAN SYSTEM</Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          className="bg-primary/20 p-2 rounded-full"
        >
          <Ionicons name="refresh" size={20} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      <View className="flex-row bg-surface border-b border-border">
        <TabButton id="overview" label="Overview" icon="grid-outline" />
        <TabButton id="accounts" label="Accounts" icon="people-outline" />
        <TabButton id="analytics" label="Analytics" icon="bar-chart-outline" />
        <TabButton id="alerts" label="Alerts" icon="notifications-outline" />
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
      >
        {selectedTab === 'overview' && <OverviewTab />}
        {selectedTab === 'accounts' && (
          <View className="p-4 items-center"><Text className="text-muted">Accounts view loading...</Text></View>
        )}
        {selectedTab === 'analytics' && (
          <View className="p-4 items-center"><Text className="text-muted">Analytics view loading...</Text></View>
        )}
        {selectedTab === 'alerts' && (
          <View className="p-4 items-center"><Text className="text-muted">Alerts view loading...</Text></View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
