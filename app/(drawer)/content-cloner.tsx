import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';

export default function ContentClonerScreen() {
    const colors = useColors();
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'tasks' | 'logs'>('tasks');

    const { data: tasks, isLoading, refetch } = (trpc.contentCloner as any).getTasks.useQuery(undefined);

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    return (
        <ScreenContainer className="bg-background">
            <SafeAreaView className="flex-1">
                <View className="flex-row items-center justify-between p-4 border-b border-border">
                    <Text className="text-2xl font-bold text-foreground">نسخ المحتوى</Text>
                    <TouchableOpacity onPress={() => Alert.alert('Coming Soon', 'Create Task Dialog')}>
                        <IconSymbol name="plus.circle.fill" size={24} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                <View className="flex-row bg-surface border-b border-border">
                    {[
                        { key: 'tasks', label: 'المهام', icon: 'list.bullet' },
                        { key: 'logs', label: 'السجل', icon: 'clock' }
                    ].map((tab) => (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setActiveTab(tab.key as any)}
                            className={`flex-1 py-3 ${activeTab === tab.key ? 'border-b-2 border-primary' : ''}`}
                        >
                            <View className="items-center">
                                <IconSymbol name={tab.icon} size={20} color={activeTab === tab.key ? colors.primary : colors.muted} />
                                <Text className={`text-sm mt-1 ${activeTab === tab.key ? 'text-primary' : 'text-muted'}`}>{tab.label}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                <ScrollView contentContainerStyle={{ flexGrow: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                    {activeTab === 'tasks' && (
                        <View className="p-4">
                            {isLoading ? (
                                <ActivityIndicator size="large" color={colors.primary} />
                            ) : (
                                tasks?.map((task: any) => (
                                    <View key={task.id} className="bg-surface p-4 rounded-xl border border-border mb-3">
                                        <Text className="font-semibold text-foreground">{task.name}</Text>
                                        <Text className="text-muted text-sm">Source: {task.sourceChannel} → Target: {task.targetChannels.join(', ')}</Text>
                                    </View>
                                ))
                            )}
                            {!isLoading && (!tasks || tasks.length === 0) && (
                                <Text className="text-center text-muted mt-10">لا توجد مهام نسخ محتوى حالياً</Text>
                            )}
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </ScreenContainer>
    );
}
