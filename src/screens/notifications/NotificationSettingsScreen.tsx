import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SettingSwitch, SettingSection } from '#components/settings';
import { useNotificationSettings } from '#hooks';
import { ExpirationFrequency } from '#generated';
import { Picker } from '@react-native-picker/picker';

export const NotificationSettingsScreen: React.FC = () => {
  const [updating, setUpdating] = useState<string | null>(null);

  const {
    settings,
    loading,
    updateNotificationSetting,
    resetToDefaults,
    isQuietTime,
  } = useNotificationSettings();

  const handleSettingChange = async (key: string, value: boolean | string | number | ExpirationFrequency) => {
    setUpdating(key);
    try {
      const success = await updateNotificationSetting(key as any, value);
      if (!success) {
        Alert.alert('Error', 'Failed to update settings. Please try again.');
      }
    } finally {
      setUpdating(null);
    }
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset to Defaults',
      'Are you sure you want to reset all notification settings to their default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setUpdating('reset');
            try {
              const success = await resetToDefaults();
              if (success) {
                Alert.alert('Success', 'Settings have been reset to defaults.');
              } else {
                Alert.alert(
                  'Error',
                  'Failed to reset settings. Please try again.',
                );
              }
            } finally {
              setUpdating(null);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Quiet Hours Status */}
      {isQuietTime() && (
        <View style={styles.quietTimeAlert}>
          <Text style={styles.quietTimeText}>
            🌙 Quiet hours are active - notifications are muted
          </Text>
        </View>
      )}

      <SettingSection title="General Notifications">
        <SettingSwitch
          title="Push Notifications"
          description="Receive push notifications on your device"
          value={settings.pushEnabled}
          onValueChange={value =>
            handleSettingChange('pushEnabled', value)
          }
          loading={updating === 'pushEnabled'}
        />
        <SettingSwitch
          title="Email Notifications"
          description="Receive notifications via email"
          value={settings.emailEnabled}
          onValueChange={value =>
            handleSettingChange('emailEnabled', value)
          }
          loading={updating === 'emailEnabled'}
        />
        <SettingSwitch
          title="SMS Notifications"
          description="Receive text message notifications"
          value={settings.smsEnabled}
          onValueChange={value =>
            handleSettingChange('smsEnabled', value)
          }
          loading={updating === 'smsEnabled'}
        />
      </SettingSection>

      <SettingSection title="Pantry Notifications">
        <SettingSwitch
          title="Expiration Alerts"
          description="Get notified when items are about to expire"
          value={settings.expirationNotifications}
          onValueChange={value =>
            handleSettingChange('expirationNotifications', value)
          }
          loading={updating === 'expirationNotifications'}
        />

        {settings.expirationNotifications && (
          <>
            <View style={styles.indentedSetting}>
              <Text style={styles.settingLabel}>Notification Frequency</Text>
              <Picker
                selectedValue={settings.expirationNotificationFrequency}
                onValueChange={(value) =>
                  handleSettingChange('expirationNotificationFrequency', value)
                }
                style={styles.picker}
              >
                <Picker.Item label="Real-time (as items expire)" value={ExpirationFrequency.RealTime} />
                <Picker.Item label="Daily - Morning" value={ExpirationFrequency.DailyMorning} />
                <Picker.Item label="Daily - Evening" value={ExpirationFrequency.DailyEvening} />
                <Picker.Item label="Weekly Digest" value={ExpirationFrequency.WeeklyDigest} />
                <Picker.Item label="Never" value={ExpirationFrequency.Never} />
              </Picker>
            </View>

            <View style={styles.indentedSetting}>
              <Text style={styles.settingLabel}>
                Alert threshold: {settings.expirationDaysThreshold} day{settings.expirationDaysThreshold !== 1 ? 's' : ''} before expiration
              </Text>
              <Picker
                selectedValue={settings.expirationDaysThreshold}
                onValueChange={(value) =>
                  handleSettingChange('expirationDaysThreshold', Number(value))
                }
                style={styles.picker}
              >
                <Picker.Item label="Same day (0 days)" value={0} />
                <Picker.Item label="1 day before" value={1} />
                <Picker.Item label="2 days before" value={2} />
                <Picker.Item label="3 days before" value={3} />
                <Picker.Item label="5 days before" value={5} />
                <Picker.Item label="7 days before" value={7} />
              </Picker>
            </View>
          </>
        )}

        <SettingSwitch
          title="Low Stock Alerts"
          description="Get notified when pantry items are running low"
          value={settings.lowStockAlerts}
          onValueChange={value => handleSettingChange('lowStockAlerts', value)}
          loading={updating === 'lowStockAlerts'}
        />
        <SettingSwitch
          title="Pantry Updates"
          description="Get notified when items are added or updated"
          value={settings.pantryChanges}
          onValueChange={value => handleSettingChange('pantryChanges', value)}
          loading={updating === 'pantryChanges'}
        />
      </SettingSection>

      <SettingSection title="Shopping List Notifications">
        <SettingSwitch
          title="List Updates"
          description="Get notified when shared lists are updated"
          value={settings.shoppingListUpdates}
          onValueChange={value =>
            handleSettingChange('shoppingListUpdates', value)
          }
          loading={updating === 'shoppingListUpdates'}
        />
        <SettingSwitch
          title="Shared List Updates"
          description="Get notified about changes in shared lists"
          value={settings.sharedListUpdates}
          onValueChange={value =>
            handleSettingChange('sharedListUpdates', value)
          }
          loading={updating === 'sharedListUpdates'}
        />
      </SettingSection>

      <SettingSection title="Collaboration & Home">
        <SettingSwitch
          title="Collaboration Invites"
          description="Get notified when invited to collaborate on lists"
          value={settings.collaborationInvites}
          onValueChange={value =>
            handleSettingChange('collaborationInvites', value)
          }
          loading={updating === 'collaborationInvites'}
        />
        <SettingSwitch
          title="Home Invitations"
          description="Get notified about invitations to join homes"
          value={settings.homeInvites}
          onValueChange={value => handleSettingChange('homeInvites', value)}
          loading={updating === 'homeInvites'}
        />
      </SettingSection>

      <SettingSection title="Recipes & Meal Planning">
        <SettingSwitch
          title="Recipe Recommendations"
          description="Get recipe suggestions based on your pantry items"
          value={settings.recipeRecommendations}
          onValueChange={value =>
            handleSettingChange('recipeRecommendations', value)
          }
          loading={updating === 'recipeRecommendations'}
        />
        <SettingSwitch
          title="Meal Plan Reminders"
          description="Get reminders about upcoming meals"
          value={settings.mealPlanReminders}
          onValueChange={value =>
            handleSettingChange('mealPlanReminders', value)
          }
          loading={updating === 'mealPlanReminders'}
        />
        <SettingSwitch
          title="Cooking Reminders"
          description="Get reminders when it's time to start cooking"
          value={settings.cookingReminders}
          onValueChange={value =>
            handleSettingChange('cookingReminders', value)
          }
          loading={updating === 'cookingReminders'}
        />
      </SettingSection>

      <SettingSection title="Digests & Reports">
        <SettingSwitch
          title="Weekly Digest"
          description="Receive a weekly summary of your pantry activity"
          value={settings.weeklyDigest}
          onValueChange={value => handleSettingChange('weeklyDigest', value)}
          loading={updating === 'weeklyDigest'}
        />
        <SettingSwitch
          title="Monthly Report"
          description="Receive a monthly report with insights and statistics"
          value={settings.monthlyReport}
          onValueChange={value => handleSettingChange('monthlyReport', value)}
          loading={updating === 'monthlyReport'}
        />
      </SettingSection>

      <SettingSection title="Quiet Hours">
        <SettingSwitch
          title="Enable Quiet Hours"
          description="Mute notifications during specified hours"
          value={settings.quietHoursEnabled}
          onValueChange={value => handleSettingChange('quietHoursEnabled', value)}
          loading={updating === 'quietHoursEnabled'}
        />
        {settings.quietHoursEnabled && (
          <View style={styles.quietHoursInfo}>
            <Text style={styles.quietHoursText}>
              Quiet hours: {settings.quietHoursStart || '22:00'} - {settings.quietHoursEnd || '08:00'}
            </Text>
            <Text style={styles.quietHoursSubtext}>
              Notifications will be muted during these hours
            </Text>
          </View>
        )}
      </SettingSection>

      <SettingSection title="Reset">
        <SettingSwitch
          title="Reset to Defaults"
          description="Reset all notification settings to their default values"
          value={false}
          onValueChange={handleResetToDefaults}
          loading={updating === 'reset'}
        />
      </SettingSection>
    </ScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
  },
  quietTimeAlert: {
    backgroundColor: '#E8F4FD',
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  quietTimeText: {
    fontSize: 14,
    color: '#1565C0',
    textAlign: 'center',
  },
  indentedSetting: {
    marginLeft: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: theme.spacing.sm,
  },
  settingLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    fontWeight: '500',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  quietHoursInfo: {
    marginLeft: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: theme.spacing.sm,
  },
  quietHoursText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
  },
  quietHoursSubtext: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
}));
