import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  RefreshControl,
  Modal,
  Switch,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { trpc } from '@/lib/trpc';

/**
 * Developer Dashboard - Permission Control
 * لوحة تحكم المطور - إدارة التصاريح
 * 
 * Features:
 * - View all permissions
 * - Create new permissions
 * - Suspend/Activate/Revoke permissions
 * - Extend permission duration
 * - Update permission limits
 * - Permission analytics
 */

type PermissionType = 'trial' | 'basic' | 'premium' | 'unlimited';
type PermissionStatus = 'active' | 'suspended' | 'expired' | 'revoked';

interface Permission {
  id: number;
  deviceId: string;
  deviceName?: string;
  permissionKey: string;
  status: PermissionStatus;
  permissionType: PermissionType;
  maxAccounts: number;
  maxMessagesPerDay: number;
  maxOperationsPerDay: number;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: number;
  suspendReason?: string;
  notes?: string;
}

export default function DeveloperDashboardScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'permissions' | 'create'>('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [extendDays, setExtendDays] = useState('30');

  // Form state for creating new permission
  const [newPermission, setNewPermission] = useState({
    deviceId: '',
    deviceName: '',
    permissionType: 'trial' as PermissionType,
    durationDays: '30',
    notes: '',
  });

  // tRPC queries
  const { data: statsData, refetch: refetchStats, isLoading: statsLoading } =
    trpc.permission.getStats.useQuery(undefined);
  const { data: permissionsData, refetch: refetchPermissions, isLoading: permissionsLoading } =
    trpc.permission.getAllPermissions.useQuery(undefined);

  // tRPC mutations
  const createPermission = trpc.permission.createPermission.useMutation();
  const suspendPermission = trpc.permission.suspendPermission.useMutation();
  const activatePermission = trpc.permission.activatePermission.useMutation();
  const revokePermission = trpc.permission.revokePermission.useMutation();
  const extendPermission = trpc.permission.extendPermission.useMutation();
  const deletePermission = trpc.permission.deletePermission.useMutation();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchPermissions()]);
    setRefreshing(false);
  }, [refetchStats, refetchPermissions]);

  const handleCreatePermission = async () => {
    if (!newPermission.deviceId.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال معرف الجهاز');
      return;
    }

    createPermission.mutate({
      deviceId: newPermission.deviceId,
      deviceName: newPermission.deviceName || undefined,
      permissionType: newPermission.permissionType,
      durationDays: parseInt(newPermission.durationDays) || 30,
      notes: newPermission.notes || undefined,
    }, {
      onSuccess: (result: any) => {
        if (result.success) {
          Alert.alert('نجاح', `تم إنشاء التصريح بنجاح\n\nمفتاح التصريح:\n${result.permission?.permissionKey}`);
          setNewPermission({
            deviceId: '',
            deviceName: '',
            permissionType: 'trial',
            durationDays: '30',
            notes: '',
          });
          setShowCreateModal(false);
          onRefresh();
        } else {
          Alert.alert('خطأ', result.error || 'فشل إنشاء التصريح');
        }
      },
      onError: () => {
        Alert.alert('خطأ', 'حدث خطأ أثناء إنشاء التصريح');
      }
    });
  };

  const handleSuspend = () => {
    if (!selectedPermission || !suspendReason.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال سبب التعليق');
      return;
    }

    suspendPermission.mutate({
      permissionId: selectedPermission.id,
      reason: suspendReason,
    }, {
      onSuccess: (result: any) => {
        if (result.success) {
          Alert.alert('نجاح', 'تم تعليق التصريح');
          setShowActionModal(false);
          setSuspendReason('');
          onRefresh();
        } else {
          Alert.alert('خطأ', result.message);
        }
      },
      onError: () => {
        Alert.alert('خطأ', 'فشل تعليق التصريح');
      }
    });
  };

  const handleActivate = () => {
    if (!selectedPermission) return;

    activatePermission.mutate({
      permissionId: selectedPermission.id,
    }, {
      onSuccess: (result: any) => {
        if (result.success) {
          Alert.alert('نجاح', 'تم تفعيل التصريح');
          setShowActionModal(false);
          onRefresh();
        } else {
          Alert.alert('خطأ', result.message);
        }
      },
      onError: () => {
        Alert.alert('خطأ', 'فشل تفعيل التصريح');
      }
    });
  };

  const handleRevoke = async () => {
    if (!selectedPermission) return;

    Alert.alert(
      'تأكيد الإلغاء',
      'هل أنت متأكد من إلغاء هذا التصريح نهائياً؟ لا يمكن التراجع عن هذا الإجراء.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تأكيد',
          style: 'destructive',
          onPress: () => {
            revokePermission.mutate({
              permissionId: selectedPermission.id,
            }, {
              onSuccess: (result: any) => {
                if (result.success) {
                  Alert.alert('نجاح', 'تم إلغاء التصريح');
                  setShowActionModal(false);
                  onRefresh();
                } else {
                  Alert.alert('خطأ', result.message);
                }
              },
              onError: () => {
                Alert.alert('خطأ', 'فشل إلغاء التصريح');
              }
            });
          },
        },
      ]
    );
  };

  const handleExtend = () => {
    if (!selectedPermission) return;

    extendPermission.mutate({
      permissionId: selectedPermission.id,
      additionalDays: parseInt(extendDays) || 30,
    }, {
      onSuccess: (result: any) => {
        if (result.success) {
          Alert.alert('نجاح', result.message);
          setShowActionModal(false);
          setExtendDays('30');
          onRefresh();
        } else {
          Alert.alert('خطأ', result.message);
        }
      },
      onError: () => {
        Alert.alert('خطأ', 'فشل تمديد التصريح');
      }
    });
  };

  const handleDelete = async () => {
    if (!selectedPermission) return;

    Alert.alert(
      'تأكيد الحذف',
      'هل أنت متأكد من حذف هذا التصريح؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => {
            deletePermission.mutate({
              permissionId: selectedPermission.id,
            }, {
              onSuccess: (result: any) => {
                if (result.success) {
                  Alert.alert('نجاح', 'تم حذف التصريح');
                  setShowActionModal(false);
                  onRefresh();
                } else {
                  Alert.alert('خطأ', result.message);
                }
              },
              onError: () => {
                Alert.alert('خطأ', 'فشل حذف التصريح');
              }
            });
          },
        },
      ]
    );
  };

  const getStatusColor = (status: PermissionStatus) => {
    switch (status) {
      case 'active': return colors.success;
      case 'suspended': return colors.warning;
      case 'expired': return '#6b7280';
      case 'revoked': return colors.error;
      default: return colors.muted;
    }
  };

  const getStatusText = (status: PermissionStatus) => {
    switch (status) {
      case 'active': return 'نشط';
      case 'suspended': return 'معلق';
      case 'expired': return 'منتهي';
      case 'revoked': return 'ملغي';
      default: return status;
    }
  };

  const getTypeText = (type: PermissionType) => {
    switch (type) {
      case 'trial': return 'تجريبي';
      case 'basic': return 'أساسي';
      case 'premium': return 'مميز';
      case 'unlimited': return 'غير محدود';
      default: return type;
    }
  };

  const getTypeColor = (type: PermissionType) => {
    switch (type) {
      case 'trial': return '#6b7280';
      case 'basic': return colors.primary;
      case 'premium': return colors.warning;
      case 'unlimited': return colors.success;
      default: return colors.muted;
    }
  };

  const stats = statsData?.stats || {
    total: 0, active: 0, suspended: 0, expired: 0, revoked: 0,
    trial: 0, basic: 0, premium: 0, unlimited: 0,
    expiringSoon: 0, recentlyActive: 0,
  };

  const permissions = permissionsData?.permissions || [];

  const renderOverview = () => (
    <View className="gap-4">
      {/* Stats Grid */}
      <View className="flex-row flex-wrap gap-3">
        <View className="flex-1 min-w-[45%] bg-surface rounded-2xl p-4 border border-border">
          <View className="flex-row items-center gap-2 mb-2">
            <View className="w-8 h-8 rounded-full items-center justify-center bg-primary/10">
              <IconSymbol name="person.2.fill" size={16} color={colors.primary} />
            </View>
            <Text className="text-xs text-muted">إجمالي التصاريح</Text>
          </View>
          <Text className="text-2xl font-bold text-foreground">{stats.total}</Text>
        </View>

        <View className="flex-1 min-w-[45%] bg-surface rounded-2xl p-4 border border-border">
          <View className="flex-row items-center gap-2 mb-2">
            <View className="w-8 h-8 rounded-full items-center justify-center bg-success/10">
              <IconSymbol name="checkmark.circle.fill" size={16} color={colors.success} />
            </View>
            <Text className="text-xs text-muted">نشط</Text>
          </View>
          <Text className="text-2xl font-bold text-success">{stats.active}</Text>
        </View>

        <View className="flex-1 min-w-[45%] bg-surface rounded-2xl p-4 border border-border">
          <View className="flex-row items-center gap-2 mb-2">
            <View className="w-8 h-8 rounded-full items-center justify-center bg-warning/10">
              <IconSymbol name="pause.circle.fill" size={16} color={colors.warning} />
            </View>
            <Text className="text-xs text-muted">معلق</Text>
          </View>
          <Text className="text-2xl font-bold text-warning">{stats.suspended}</Text>
        </View>

        <View className="flex-1 min-w-[45%] bg-surface rounded-2xl p-4 border border-border">
          <View className="flex-row items-center gap-2 mb-2">
            <View className="w-8 h-8 rounded-full items-center justify-center bg-error/10">
              <IconSymbol name="xmark.circle.fill" size={16} color={colors.error} />
            </View>
            <Text className="text-xs text-muted">ملغي/منتهي</Text>
          </View>
          <Text className="text-2xl font-bold text-error">{stats.revoked + stats.expired}</Text>
        </View>
      </View>

      {/* Type Distribution */}
      <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
        <Text className="text-base font-semibold text-foreground">توزيع أنواع التصاريح</Text>
        <View className="flex-row justify-between">
          <View className="items-center">
            <Text className="text-lg font-bold text-muted">{stats.trial}</Text>
            <Text className="text-xs text-muted">تجريبي</Text>
          </View>
          <View className="items-center">
            <Text className="text-lg font-bold text-primary">{stats.basic}</Text>
            <Text className="text-xs text-muted">أساسي</Text>
          </View>
          <View className="items-center">
            <Text className="text-lg font-bold text-warning">{stats.premium}</Text>
            <Text className="text-xs text-muted">مميز</Text>
          </View>
          <View className="items-center">
            <Text className="text-lg font-bold text-success">{stats.unlimited}</Text>
            <Text className="text-xs text-muted">غير محدود</Text>
          </View>
        </View>
      </View>

      {/* Alerts */}
      {stats.expiringSoon > 0 && (
        <View className="bg-warning/10 border border-warning/20 rounded-2xl p-4">
          <Text className="text-warning font-semibold">
            ⚠️ {stats.expiringSoon} تصريح ينتهي خلال 3 أيام
          </Text>
        </View>
      )}

      {/* Quick Actions */}
      <TouchableOpacity
        onPress={() => setShowCreateModal(true)}
        className="bg-primary rounded-2xl p-4 items-center"
      >
        <Text className="text-white font-bold text-base">
          ➕ إنشاء تصريح جديد
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderPermissions = () => (
    <View className="gap-3">
      {permissions.length === 0 ? (
        <View className="bg-surface rounded-2xl p-8 items-center border border-border">
          <Text className="text-muted">لا توجد تصاريح</Text>
        </View>
      ) : (
        permissions.map((permission: Permission) => (
          <TouchableOpacity
            key={permission.id}
            onPress={() => {
              setSelectedPermission(permission);
              setShowActionModal(true);
            }}
            className="bg-surface rounded-2xl p-4 border border-border"
            style={{ borderLeftWidth: 4, borderLeftColor: getStatusColor(permission.status) }}
          >
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1">
                <Text className="text-sm font-mono text-foreground">
                  {permission.permissionKey}
                </Text>
                <Text className="text-xs text-muted mt-1">
                  {permission.deviceName || permission.deviceId}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <View
                  className="px-2 py-1 rounded-full"
                  style={{ backgroundColor: getStatusColor(permission.status) + '20' }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: getStatusColor(permission.status) }}
                  >
                    {getStatusText(permission.status)}
                  </Text>
                </View>
                <View
                  className="px-2 py-1 rounded-full"
                  style={{ backgroundColor: getTypeColor(permission.permissionType) + '20' }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: getTypeColor(permission.permissionType) }}
                  >
                    {getTypeText(permission.permissionType)}
                  </Text>
                </View>
              </View>
            </View>

            <View className="flex-row justify-between mt-2">
              <Text className="text-xs text-muted">
                استخدام: {permission.usageCount}
              </Text>
              {permission.expiresAt && (
                <Text className="text-xs text-muted">
                  ينتهي: {new Date(permission.expiresAt).toLocaleDateString('ar-SA')}
                </Text>
              )}
            </View>

            {permission.suspendReason && (
              <Text className="text-xs text-error mt-2">
                سبب التعليق: {permission.suspendReason}
              </Text>
            )}
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View className="p-6 gap-6">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold text-foreground">
                🔐 لوحة تحكم المطور
              </Text>
              <Text className="text-sm text-muted mt-1">
                إدارة تصاريح التطبيق
              </Text>
            </View>
          </View>

          {/* Tab Selector */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setActiveTab('overview')}
              className={`flex-1 py-3 rounded-xl items-center ${activeTab === 'overview' ? 'bg-primary' : 'bg-surface border border-border'
                }`}
            >
              <Text className={activeTab === 'overview' ? 'text-white font-semibold' : 'text-foreground'}>
                نظرة عامة
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('permissions')}
              className={`flex-1 py-3 rounded-xl items-center ${activeTab === 'permissions' ? 'bg-primary' : 'bg-surface border border-border'
                }`}
            >
              <Text className={activeTab === 'permissions' ? 'text-white font-semibold' : 'text-foreground'}>
                التصاريح ({permissions.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'permissions' && renderPermissions()}
        </View>
      </ScrollView>

      {/* Create Permission Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View className="flex-1 bg-background">
          <View className="p-6 border-b border-border flex-row justify-between items-center">
            <Text className="text-lg font-bold text-foreground">إنشاء تصريح جديد</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-6">
            <View className="gap-4">
              <View>
                <Text className="text-sm font-medium text-foreground mb-2">معرف الجهاز *</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  value={newPermission.deviceId}
                  onChangeText={(text) => setNewPermission({ ...newPermission, deviceId: text })}
                  placeholder="أدخل معرف الجهاز الفريد"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-foreground mb-2">اسم الجهاز</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  value={newPermission.deviceName}
                  onChangeText={(text) => setNewPermission({ ...newPermission, deviceName: text })}
                  placeholder="مثال: هاتف أحمد"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-foreground mb-2">نوع التصريح</Text>
                <View className="flex-row gap-2 flex-wrap">
                  {(['trial', 'basic', 'premium', 'unlimited'] as PermissionType[]).map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setNewPermission({ ...newPermission, permissionType: type })}
                      className={`px-4 py-2 rounded-xl ${newPermission.permissionType === type
                        ? 'bg-primary'
                        : 'bg-surface border border-border'
                        }`}
                    >
                      <Text className={
                        newPermission.permissionType === type
                          ? 'text-white font-medium'
                          : 'text-foreground'
                      }>
                        {getTypeText(type)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text className="text-sm font-medium text-foreground mb-2">مدة التصريح (أيام)</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  value={newPermission.durationDays}
                  onChangeText={(text) => setNewPermission({ ...newPermission, durationDays: text })}
                  placeholder="30"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-foreground mb-2">ملاحظات</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  value={newPermission.notes}
                  onChangeText={(text) => setNewPermission({ ...newPermission, notes: text })}
                  placeholder="ملاحظات إضافية..."
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                onPress={handleCreatePermission}
                className="bg-success rounded-xl p-4 items-center mt-4"
              >
                <Text className="text-white font-bold text-base">إنشاء التصريح</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowActionModal(false)}
      >
        <View className="flex-1 bg-background">
          <View className="p-6 border-b border-border flex-row justify-between items-center">
            <Text className="text-lg font-bold text-foreground">إدارة التصريح</Text>
            <TouchableOpacity onPress={() => setShowActionModal(false)}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-6">
            {selectedPermission && (
              <View className="gap-4">
                {/* Permission Info */}
                <View className="bg-surface rounded-xl p-4 border border-border gap-2">
                  <Text className="text-sm font-mono text-primary">
                    {selectedPermission.permissionKey}
                  </Text>
                  <Text className="text-sm text-foreground">
                    الجهاز: {selectedPermission.deviceName || selectedPermission.deviceId}
                  </Text>
                  <Text className="text-sm text-foreground">
                    النوع: {getTypeText(selectedPermission.permissionType)}
                  </Text>
                  <Text className="text-sm text-foreground">
                    الحالة: {getStatusText(selectedPermission.status)}
                  </Text>
                  <Text className="text-sm text-foreground">
                    الاستخدام: {selectedPermission.usageCount} مرة
                  </Text>
                  {selectedPermission.expiresAt && (
                    <Text className="text-sm text-foreground">
                      ينتهي: {new Date(selectedPermission.expiresAt).toLocaleDateString('ar-SA')}
                    </Text>
                  )}
                </View>

                {/* Actions based on status */}
                {selectedPermission.status === 'active' && (
                  <>
                    <View>
                      <Text className="text-sm font-medium text-foreground mb-2">تعليق التصريح</Text>
                      <TextInput
                        className="bg-surface border border-border rounded-xl p-4 text-foreground mb-2"
                        value={suspendReason}
                        onChangeText={setSuspendReason}
                        placeholder="سبب التعليق..."
                        placeholderTextColor={colors.muted}
                      />
                      <TouchableOpacity
                        onPress={handleSuspend}
                        className="bg-warning rounded-xl p-4 items-center"
                      >
                        <Text className="text-white font-bold">تعليق</Text>
                      </TouchableOpacity>
                    </View>

                    <View>
                      <Text className="text-sm font-medium text-foreground mb-2">تمديد التصريح</Text>
                      <TextInput
                        className="bg-surface border border-border rounded-xl p-4 text-foreground mb-2"
                        value={extendDays}
                        onChangeText={setExtendDays}
                        placeholder="عدد الأيام"
                        placeholderTextColor={colors.muted}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        onPress={handleExtend}
                        className="bg-primary rounded-xl p-4 items-center"
                      >
                        <Text className="text-white font-bold">تمديد</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {selectedPermission.status === 'suspended' && (
                  <TouchableOpacity
                    onPress={handleActivate}
                    className="bg-success rounded-xl p-4 items-center"
                  >
                    <Text className="text-white font-bold">إعادة تفعيل</Text>
                  </TouchableOpacity>
                )}

                {selectedPermission.status !== 'revoked' && (
                  <TouchableOpacity
                    onPress={handleRevoke}
                    className="bg-error rounded-xl p-4 items-center"
                  >
                    <Text className="text-white font-bold">إلغاء نهائي</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={handleDelete}
                  className="bg-surface border border-error rounded-xl p-4 items-center"
                >
                  <Text className="text-error font-bold">حذف التصريح</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

