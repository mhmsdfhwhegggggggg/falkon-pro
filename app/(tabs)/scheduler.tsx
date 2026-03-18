import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, TextInput } from 'react-native';
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

/**
 * Smart Task Scheduler v1.0
 * 
 * Automate industrial operations with precision.
 * Features:
 * - Recurring tasks (Daily, Weekly).
 * - Time-window execution (Human hours).
 * - Auto-stop on threshold (Safety first).
 * - Multi-task orchestration.
 */
export default function SchedulerScreen() {
  const colors = useColors();
  const [tasks, setTasks] = useState([
    { id: 1, name: 'تسخين الحسابات الصباحي', type: 'Warming', time: '08:00 AM', active: true },
    { id: 2, name: 'استخراج أعضاء جروب العقارات', type: 'Extraction', time: '10:30 PM', active: false },
    { id: 3, name: 'إضافة أعضاء لجروب VIP', type: 'Addition', time: '02:00 PM', active: true },
  ]);

  const TaskItem = ({ task }: any) => (
    <View className="bg-surface border border-border rounded-3xl p-5 mb-4 shadow-sm">
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-2xl bg-primary/10 items-center justify-center">
            <IconSymbol 
              name={task.type === 'Warming' ? 'flame.fill' : task.type === 'Extraction' ? 'arrow.down.circle.fill' : 'person.badge.plus.fill'} 
              size={20} 
              color={colors.primary} 
            />
          </View>
          <View>
            <Text className="text-base font-bold text-foreground">{task.name}</Text>
            <Text className="text-xs text-muted">{task.type} • {task.time}</Text>
          </View>
        </View>
        <Switch 
          value={task.active} 
          onValueChange={(val) => setTasks(tasks.map(t => t.id === task.id ? { ...t, active: val } : t))}
          trackColor={{ true: colors.primary }}
        />
      </View>
      <View className="flex-row gap-2">
        <TouchableOpacity className="flex-1 bg-background border border-border py-2 rounded-xl items-center">
          <Text className="text-[10px] font-bold text-muted">تعديل</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-1 bg-error/10 border border-error/20 py-2 rounded-xl items-center">
          <Text className="text-[10px] font-bold text-error">حذف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="p-6 gap-6">
          {/* Header */}
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-3xl font-bold text-foreground">المجدول الذكي</Text>
              <Text className="text-sm text-muted mt-1">أتمتة العمليات الصناعية بدقة</Text>
            </View>
            <TouchableOpacity className="w-12 h-12 rounded-2xl bg-primary items-center justify-center shadow-lg shadow-primary/30">
              <IconSymbol name="plus" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Quick Stats */}
          <View className="flex-row gap-4">
            <View className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex-1 items-center">
              <Text className="text-xl font-bold text-primary">2</Text>
              <Text className="text-[10px] text-muted">مهام نشطة</Text>
            </View>
            <View className="bg-info/5 border border-info/10 rounded-2xl p-4 flex-1 items-center">
              <Text className="text-xl font-bold text-info">15</Text>
              <Text className="text-[10px] text-muted">عملية مجدولة</Text>
            </View>
            <View className="bg-success/5 border border-success/10 rounded-2xl p-4 flex-1 items-center">
              <Text className="text-xl font-bold text-success">100%</Text>
              <Text className="text-[10px] text-muted">دقة التنفيذ</Text>
            </View>
          </View>

          {/* Tasks List */}
          <View>
            <Text className="text-lg font-bold text-foreground mb-4">المهام الحالية</Text>
            {tasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </View>

          {/* Pro Tip */}
          <View className="bg-surface border border-border rounded-3xl p-5 flex-row items-center gap-4">
            <View className="w-12 h-12 rounded-2xl bg-warning/10 items-center justify-center">
              <IconSymbol name="lightbulb.fill" size={24} color={colors.warning} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-foreground">نصيحة الخبراء</Text>
              <Text className="text-[11px] text-muted leading-relaxed">
                جدولة المهام في أوقات الذروة البشرية (9 صباحاً - 9 مساءً) يقلل من احتمالية رصد الحسابات بنسبة 40%.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
