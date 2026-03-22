import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, RefreshControl, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';

const trpcAny = trpc as any;

export default function AutoReplyScreen() {
    const colors = useColors();
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'rules' | 'history' | 'stats'>('rules');
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

    const accountsQuery = (trpcAny.accounts.getAll.useQuery(undefined) as any);
    const accounts = accountsQuery.data || [];

    const rulesQuery = (trpcAny.autoReply.getRules.useQuery(
        { accountId: selectedAccountId || 0 },
        { enabled: !!selectedAccountId }
    ) as any);
    const rules = (rulesQuery.data as any)?.success ? (rulesQuery.data as any).data.rules : [];

    const statsQuery = (trpcAny.autoReply.getStats.useQuery(
        { accountId: selectedAccountId || 0 },
        { enabled: !!selectedAccountId }
    ) as any);
    const stats = (statsQuery.data as any)?.success ? (statsQuery.data as any).data : null;

    const onRefresh = async () => {
        setRefreshing(true);
        await rulesQuery.refetch();
        await statsQuery.refetch();
        setRefreshing(false);
    };

    return (
        <ScreenContainer className="bg-background">
            <SafeAreaView className="flex-1">
                <View className="flex-row items-center justify-between p-4 border-b border-border">
                    <View className="flex-1">
                        <Text className="text-2xl font-bold text-foreground">الردود التلقائية</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                            {(accounts as any)?.map((acc: any) => (
                                <TouchableOpacity
                                    key={acc.id}
                                    onPress={() => setSelectedAccountId(acc.id)}
                                    className={`mr-2 px-3 py-1 rounded-full border ${selectedAccountId === acc.id ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                                >
                                    <Text className={`text-xs ${selectedAccountId === acc.id ? 'text-white' : 'text-foreground'}`}>{acc.phoneNumber}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                    <TouchableOpacity onPress={() => Alert.alert('قريباً', 'نافذة إنشاء قاعدة جديدة')}>
                        <IconSymbol name="plus.circle.fill" size={24} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                <View className="flex-row bg-surface border-b border-border">
                    {[
                        { key: 'rules', label: 'القواعد', icon: 'list.bullet' },
                        { key: 'history', label: 'السجل', icon: 'clock' },
                        { key: 'stats', label: 'الإحصائيات', icon: 'chart.bar' }
                    ].map((tab) => (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setActiveTab(tab.key as any)}
                            className={`flex-1 py-3 ${activeTab === tab.key ? 'border-b-2 border-primary' : ''}`}
                        >
                            <View className="items-center">
                                <IconSymbol name={tab.icon as any} size={20} color={activeTab === tab.key ? colors.primary : colors.muted} />
                                <Text className={`text-sm mt-1 ${activeTab === tab.key ? 'text-primary' : 'text-muted'}`}>{tab.label}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                <ScrollView contentContainerStyle={{ flexGrow: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                    {activeTab === 'rules' && (
                        <View className="p-4">
                            {rulesQuery.isLoading ? (
                                <ActivityIndicator size="large" color={colors.primary} />
                            ) : (
                                rules?.map((rule: any) => (
                                    <View key={rule.id} className="bg-surface p-4 rounded-xl border border-border mb-3">
                                        <View className="flex-row justify-between">
                                            <Text className="font-semibold text-foreground">{rule.name}</Text>
                                            <Switch value={rule.isActive} />
                                        </View>
                                        <Text className="text-muted mt-2">الكلمات المفتاحية: {rule.keywords.join(', ')}</Text>
                                    </View>
                                ))
                            )}
                            {!rulesQuery.isLoading && (!rules || rules.length === 0) && (
                                <Text className="text-center text-muted mt-10">لا توجد قواعد رد تلقائي حالياً</Text>
                            )}
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </ScreenContainer>
    );
}
