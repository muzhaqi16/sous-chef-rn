import React, {useState} from 'react';
import {View, Text, ScrollView, Alert} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {SettingSwitch, SettingSection} from '#components/settings';
import {useNotificationSettings} from '#hooks';
import {useStore} from '#/store';

export const NotificationSettingsScreen: React.FC = () => {
  const user = useStore(state => state.user);
  const [updating, setUpdating] = useState<string | null>(null);

  const {
    settings,
    loading,
    updateNotificationSetting,
    resetToDefaults,
    isQuietTime,
  } = useNotificationSettings();

  const handleSettingChange = async (key: string, value: boolean) => {
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
        {text: 'Cancel', style: 'cancel'},
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
          value={settings.pushNotifications}
          onValueChange={value =>
            handleSettingChange('pushNotifications', value)
          }
        />
        <SettingSwitch
          title="Email Notifications"
          description="Receive notifications via email"
          value={settings.emailNotifications}
          onValueChange={value =>
            handleSettingChange('emailNotifications', value)
          }
          loading={updating === 'emailNotifications'}
        />
        <SettingSwitch
          title="SMS Notifications"
          description="Receive text message notifications"
          value={settings.smsNotifications}
          onValueChange={value =>
            handleSettingChange('smsNotifications', value)
          }
          loading={updating === 'smsNotifications'}
        />
        <SettingSwitch
          title="Urgent Only Mode"
          description="Only receive urgent notifications (low stock, expiration)"
          value={settings.urgentNotificationsOnly}
          onValueChange={value =>
            handleSettingChange('urgentNotificationsOnly', value)
          }
          loading={updating === 'urgentNotificationsOnly'}
        />
      </SettingSection>

      <SettingSection title="Pantry Notifications">
        <SettingSwitch
          title="Expiration Alerts"
          description="Get notified when items are about to expire"
          value={settings.expiredItemAlerts}
          onValueChange={value =>
            handleSettingChange('expiredItemAlerts', value)
          }
          loading={updating === 'expiredItemAlerts'}
        />
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
          value={settings.pantryUpdates}
          onValueChange={value => handleSettingChange('pantryUpdates', value)}
          loading={updating === 'pantryUpdates'}
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
          title="Collaborator Changes"
          description="Get notified when collaborators are added or removed"
          value={settings.collaboratorChanges}
          onValueChange={value =>
            handleSettingChange('collaboratorChanges', value)
          }
          loading={updating === 'collaboratorChanges'}
        />
        <SettingSwitch
          title="Item Completed"
          description="Get notified when others mark items as purchased"
          value={settings.itemCompletedNotifications}
          onValueChange={value =>
            handleSettingChange('itemCompletedNotifications', value)
          }
          loading={updating === 'itemCompletedNotifications'}
        />
      </SettingSection>

      <SettingSection title="Home & Membership">
        <SettingSwitch
          title="Home Invitations"
          description="Get notified about invitations to join homes"
          value={settings.homeInvitations}
          onValueChange={value => handleSettingChange('homeInvitations', value)}
          loading={updating === 'homeInvitations'}
        />
        <SettingSwitch
          title="Membership Changes"
          description="Get notified about role changes and permissions"
          value={settings.membershipChanges}
          onValueChange={value =>
            handleSettingChange('membershipChanges', value)
          }
          loading={updating === 'membershipChanges'}
        />
        <SettingSwitch
          title="New Members"
          description="Get notified when new members join your home"
          value={settings.newMemberNotifications}
          onValueChange={value =>
            handleSettingChange('newMemberNotifications', value)
          }
          loading={updating === 'newMemberNotifications'}
        />
      </SettingSection>

      <SettingSection title="Schedule & Preferences">
        <SettingSwitch
          title="Quiet Hours"
          description="Mute notifications during specified hours"
          value={settings.quietHours}
          onValueChange={value => handleSettingChange('quietHours', value)}
          loading={updating === 'quietHours'}
        />
        <SettingSwitch
          title="Weekly Digest"
          description="Receive a weekly summary of your pantry activity"
          value={settings.weeklyDigest}
          onValueChange={value => handleSettingChange('weeklyDigest', value)}
          loading={updating === 'weeklyDigest'}
        />
        <SettingSwitch
          title="Recipe Recommendations"
          description="Get recipe suggestions based on your pantry items"
          value={settings.recipeRecommendations}
          onValueChange={value =>
            handleSettingChange('recipeRecommendations', value)
          }
          loading={updating === 'recipeRecommendations'}
        />
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
}));
