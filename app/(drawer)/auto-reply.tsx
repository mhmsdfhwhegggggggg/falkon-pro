import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, RefreshControl, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';

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
            {/* Header with Account Selector */}
            <View className="px-6 py-4 border-b border-border/40">
                <View className="flex-row items-center justify-between mb-6">
                    <View>
                        <Text className="text-3xl font-black text-foreground tracking-tight">الردود التلقائية</Text>
                        <Text className="text-sm text-muted/70 font-medium">إدارة قواعد الرد الذكي للحسابات</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => Alert.alert('قريباً', 'نافذة إنشاء قاعدة جديدة')}
                        className="bg-primary/10 p-3 rounded-2xl border border-primary/20"
                    >
                        <IconSymbol name="plus" size={24} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                <Text className="text-[10px] font-bold text-muted uppercase mb-3 tracking-widest">اختر الحساب</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-3">
                    {(accounts as any)?.map((acc: any) => (
                        <TouchableOpacity
                            key={acc.id}
                            onPress={() => setSelectedAccountId(acc.id)}
                            className={cn(
                                "px-4 py-2.5 rounded-2xl border flex-row items-center gap-2",
                                selectedAccountId === acc.id 
                                    ? 'bg-primary border-primary shadow-sm shadow-primary/40' 
                                    : 'bg-zinc-100 dark:bg-zinc-900 border-border/40'
                            )}
                        >
                            <View className={cn("w-2 h-2 rounded-full", selectedAccountId === acc.id ? "bg-white" : "bg-success")} />
                            <Text className={cn("text-sm font-bold", selectedAccountId === acc.id ? 'text-white' : 'text-foreground')}>
                                {acc.phoneNumber}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Tabs Selector */}
            <View className="flex-row px-6 py-2 gap-2 bg-surface/30">
                {[
                    { key: 'rules', label: 'القواعد', icon: 'list.bullet' },
                    { key: 'history', label: 'السجل', icon: 'clock' },
                    { key: 'stats', label: 'الإحصائيات', icon: 'chart.bar' }
                ].map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        onPress={() => setActiveTab(tab.key as any)}
                        className={cn(
                            "flex-1 flex-row items-center justify-center py-3 gap-2 rounded-2xl",
                            activeTab === tab.key ? 'bg-primary/10' : ''
                        )}
                    >
                        <IconSymbol name={tab.icon as any} size={18} color={activeTab === tab.key ? colors.primary : colors.muted} />
                        <Text className={cn("text-xs font-black", activeTab === tab.key ? 'text-primary' : 'text-muted')}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Main Content */}
            <ScrollView 
                contentContainerStyle={{ flexGrow: 1, padding: 24 }} 
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                {!selectedAccountId && (
                    <View className="flex-1 items-center justify-center py-20 opacity-50">
                        <IconSymbol name="person.crop.circle.badge.questionmark" size={64} color={colors.muted} />
                        <Text className="text-base font-bold text-muted mt-4">برجاء اختيار حساب للبدء</Text>
                    </View>
                )}

                {selectedAccountId && activeTab === 'rules' && (
                    <View className="gap-4">
                        {rulesQuery.isLoading ? (
                            <ActivityIndicator size="large" color={colors.primary} />
                        ) : (
                            rules?.map((rule: any) => (
                                <GlassCard key={rule.id} className="p-0 border-l-4 border-l-primary">
                                    <View className="p-5">
                                        <View className="flex-row justify-between items-start mb-4">
                                            <View className="gap-1">
                                                <Text className="text-lg font-bold text-foreground">{rule.name}</Text>
                                                <Text className="text-xs text-muted font-medium">نظام الرد الذكي مفعّل</Text>
                                            </View>
                                            <Switch 
                                                value={rule.isActive} 
                                                trackColor={{ false: '#e2e2e7', true: colors.primary + '80' }}
                                                thumbColor={rule.isActive ? colors.primary : '#f4f4f4'}
                                            />
                                        </View>
                                        
                                        <View className="bg-zinc-100/50 dark:bg-zinc-900/50 p-3 rounded-xl border border-border/20">
                                            <Text className="text-[10px] font-bold text-muted uppercase tracking-tighter mb-1">الكلمات المفتاحية</Text>
                                            <View className="flex-row flex-wrap gap-1.5">
                                                {rule.keywords.map((kw: string, i: number) => (
                                                    <View key={i} className="bg-white/80 dark:bg-black/20 px-2 py-0.5 rounded-md border border-border/40">
                                                        <Text className="text-[10px] font-bold text-foreground">{kw}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    </View>
                                </GlassCard>
                            ))
                        )}
                        {!rulesQuery.isLoading && (!rules || rules.length === 0) && (
                            <View className="items-center py-10">
                                <Text className="text-center text-muted font-bold">لا توجد قواعد رد تلقائي حالياً</Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    </ScreenContainer>
    );
}
