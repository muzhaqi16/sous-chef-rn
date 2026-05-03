import React, { useState, useEffect, useRef } from 'react';
import { View, Platform, Linking, AppState } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { alertService } from '#/services/alertService';
import { StyleSheet } from 'react-native-unistyles';
import { useNavigation } from '@react-navigation/native';
import { SettingSwitch } from '#components/settings/SettingSwitch';
import { SettingSection } from '#components/settings/SettingSection';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import {
  useNotificationSettings,
  type NotificationSettings,
} from '#features/notifications/hooks/useNotificationSettings';
import { useNotificationPermissions } from '#features/notifications/hooks/useNotificationPermissions';
import { ExpirationFrequency } from '#/graphql/generated/schemaTypes';
import { ModalPicker } from '#components/molecules/ModalPicker';
import { AlertBanner } from '#components/molecules/AlertBanner';
import {
  executeWithLoadingState,
  executeRefreshWithFinally,
} from '#/utils/compilerSafeWrappers';
import { Text } from '#components/atoms/Text';

interface SettingDef {
  key: keyof NotificationSettings;
  title: string;
  description: string;
  getValue?: (
    settings: NotificationSettings,
    hasPermission: boolean | null,
  ) => boolean;
}

const CHANNEL_SETTINGS: SettingDef[] = [
  {
    key: 'pushEnabled',
    title: 'Push Notifications',
    description: 'Receive push notifications on your device',
    getValue: (settings, hasPermission) =>
      !!settings.pushEnabled && hasPermission === true,
  },
  {
    key: 'emailEnabled',
    title: 'Email Notifications',
    description: 'Receive notifications via email',
  },
  {
    key: 'smsEnabled',
    title: 'SMS Notifications',
    description: 'Receive text message notifications',
  },
];

const PANTRY_SETTINGS: SettingDef[] = [
  {
    key: 'lowStockAlerts',
    title: 'Low Stock Alerts',
    description: 'Get notified when pantry items are running low',
  },
  {
    key: 'pantryChanges',
    title: 'Pantry Updates',
    description: 'Get notified when items are added or updated',
  },
];

const SHOPPING_SETTINGS: SettingDef[] = [
  {
    key: 'shoppingListUpdates',
    title: 'List Updates',
    description: 'Get notified when shared lists are updated',
  },
  {
    key: 'sharedListUpdates',
    title: 'Shared List Updates',
    description: 'Get notified about changes in shared lists',
  },
];

const SOCIAL_SETTINGS: SettingDef[] = [
  {
    key: 'collaborationInvites',
    title: 'Collaboration Invites',
    description: 'Get notified when invited to collaborate on lists',
  },
  {
    key: 'homeInvites',
    title: 'Home Invitations',
    description: 'Get notified about invitations to join homes',
  },
];

const RECIPE_SETTINGS: SettingDef[] = [
  {
    key: 'recipeRecommendations',
    title: 'Recipe Recommendations',
    description: 'Get recipe suggestions based on your pantry items',
  },
  {
    key: 'mealPlanReminders',
    title: 'Meal Plan Reminders',
    description: 'Get reminders about upcoming meals',
  },
  {
    key: 'cookingReminders',
    title: 'Cooking Reminders',
    description: "Get reminders when it's time to start cooking",
  },
];

const DIGEST_SETTINGS: SettingDef[] = [
  {
    key: 'weeklyDigest',
    title: 'Weekly Digest',
    description: 'Receive a weekly summary of your pantry activity',
  },
  {
    key: 'monthlyReport',
    title: 'Monthly Report',
    description: 'Receive a monthly report with insights and statistics',
  },
];

const QUIET_HOURS_SETTINGS: SettingDef[] = [
  {
    key: 'quietHoursEnabled',
    title: 'Enable Quiet Hours',
    description: 'Mute notifications during specified hours',
  },
];

const FREQUENCY_OPTIONS = [
  { label: 'Real-time (as items expire)', value: ExpirationFrequency.RealTime },
  { label: 'Daily - Morning', value: ExpirationFrequency.DailyMorning },
  { label: 'Daily - Evening', value: ExpirationFrequency.DailyEvening },
  { label: 'Weekly Digest', value: ExpirationFrequency.WeeklyDigest },
  { label: 'Never', value: ExpirationFrequency.Never },
];

const THRESHOLD_OPTIONS = [
  { label: 'Same day (0 days)', value: '0' },
  { label: '1 day before', value: '1' },
  { label: '2 days before', value: '2' },
  { label: '3 days before', value: '3' },
  { label: '5 days before', value: '5' },
  { label: '7 days before', value: '7' },
];

const renderSettings = (
  defs: SettingDef[],
  settings: NotificationSettings,
  hasPermission: boolean | null,
  updating: string | null,
  handleSettingChange: (
    key: keyof NotificationSettings,
    value: boolean | string | number | ExpirationFrequency,
  ) => void,
) =>
  defs.map(({ key, title, description, getValue }) => (
    <SettingSwitch
      key={key}
      title={title}
      description={description}
      value={getValue ? getValue(settings, hasPermission) : !!settings[key]}
      onValueChange={v => handleSettingChange(key, v)}
      loading={updating === key}
    />
  ));

export const NotificationSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [updating, setUpdating] = useState<string | null>(null);
  const [frequencyPickerVisible, setFrequencyPickerVisible] = useState(false);
  const [thresholdPickerVisible, setThresholdPickerVisible] = useState(false);
  const { hasPermission, requestPermissions, checkPermissions } =
    useNotificationPermissions();

  const {
    settings,
    loading,
    updateNotificationSetting,
    resetToDefaults,
    isQuietTime,
  } = useNotificationSettings();

  const appState = useRef(AppState.currentState);

  // Check permission status when screen comes into focus
  useEffect(() => {
    const checkPermsOnFocus = navigation.addListener('focus', () => {
      checkPermissions();
    });

    return checkPermsOnFocus;
  }, [navigation, checkPermissions]);

  // Re-check permissions when returning from device settings (background -> active)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        checkPermissions();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [checkPermissions]);

  const handleSettingChange = (
    key: keyof NotificationSettings,
    value: boolean | string | number | ExpirationFrequency,
  ) => {
    // Special handling for push notification toggle
    if (key === 'pushEnabled' && value === true) {
      executeWithLoadingState(
        async () => {
          const granted = await requestPermissions();

          if (!granted) {
            alertService.alert(
              'Notification Permission Required',
              'To receive push notifications, you need to enable notification permissions in your device settings.\n\nWould you like to open settings now?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    if (Platform.OS === 'ios') {
                      Linking.openURL('app-settings:');
                    } else {
                      Linking.openSettings();
                    }
                  },
                },
              ],
            );
            return;
          }

          const success = await updateNotificationSetting(key, value);
          if (!success) {
            alertService.alert(
              'Error',
              'Failed to update settings. Please try again.',
            );
          }
        },
        isLoading => setUpdating(isLoading ? key : null),
        error => {
          console.error('Error requesting notification permission:', error);
          alertService.alert(
            'Permission Error',
            'Failed to request notification permission. Please try again or check your device settings.',
          );
        },
      );
      return;
    }

    // Default handling for all other settings
    executeRefreshWithFinally(
      async () => {
        const success = await updateNotificationSetting(key, value);
        if (!success) {
          alertService.alert(
            'Error',
            'Failed to update settings. Please try again.',
          );
        }
      },
      isLoading => setUpdating(isLoading ? key : null),
    );
  };

  const handleResetToDefaults = () => {
    alertService.alert(
      'Reset to Defaults',
      'Are you sure you want to reset all notification settings to their default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            executeRefreshWithFinally(
              async () => {
                const success = await resetToDefaults();
                if (success) {
                  alertService.alert(
                    'Success',
                    'Settings have been reset to defaults.',
                  );
                } else {
                  alertService.alert(
                    'Error',
                    'Failed to reset settings. Please try again.',
                  );
                }
              },
              isLoading => setUpdating(isLoading ? 'reset' : null),
            );
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text size="md" tone="secondary">
          Loading settings...
        </Text>
      </View>
    );
  }

  return (
    <ProfileScreenWrapper title="Notification Settings">
      {/* Quiet Hours Status */}
      {isQuietTime() && (
        <View style={styles.quietTimeAlert}>
          <Text size="sm" align="center" style={styles.quietTimeText}>
            🌙 Quiet hours are active - notifications are muted
          </Text>
        </View>
      )}

      {/* Permission Status Banner */}
      {hasPermission === false && !!settings.pushEnabled && (
        <AlertBanner
          title="Notifications Disabled"
          subtitle="Notification permissions are not enabled. Tap to enable in settings."
          icon="notifications-off"
          iconLibrary="Ionicons"
          variant="warning"
          onPress={() => {
            alertService.alert(
              'Enable Notifications',
              'Notification permissions are required to receive push notifications. Would you like to open settings?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    if (Platform.OS === 'ios') {
                      Linking.openURL('app-settings:');
                    } else {
                      Linking.openSettings();
                    }
                  },
                },
              ],
            );
          }}
          showChevron
        />
      )}

      <SettingSection title="General Notifications">
        {renderSettings(
          CHANNEL_SETTINGS,
          settings,
          hasPermission,
          updating,
          handleSettingChange,
        )}
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

        {!!settings.expirationNotifications && (
          <>
            <Pressable
              style={styles.pickerRow}
              onPress={() => setFrequencyPickerVisible(true)}
            >
              <Text size="sm" weight="medium" style={styles.settingLabel}>
                Notification Frequency
              </Text>
              <Text size="sm" tone="accent" style={styles.pickerValue}>
                {FREQUENCY_OPTIONS.find(
                  o => o.value === settings.expirationNotificationFrequency,
                )?.label ?? 'Select'}
              </Text>
            </Pressable>
            <ModalPicker
              label="Notification Frequency"
              visible={frequencyPickerVisible}
              options={FREQUENCY_OPTIONS}
              selected={settings.expirationNotificationFrequency}
              onSelect={value => {
                handleSettingChange('expirationNotificationFrequency', value);
                setFrequencyPickerVisible(false);
              }}
              onCancel={() => setFrequencyPickerVisible(false)}
            />

            <Pressable
              style={styles.pickerRow}
              onPress={() => setThresholdPickerVisible(true)}
            >
              <Text size="sm" weight="medium" style={styles.settingLabel}>
                Alert Threshold
              </Text>
              <Text size="sm" tone="accent" style={styles.pickerValue}>
                {THRESHOLD_OPTIONS.find(
                  o => o.value === String(settings.expirationDaysThreshold),
                )?.label ?? 'Select'}
              </Text>
            </Pressable>
            <ModalPicker
              label="Alert Threshold"
              visible={thresholdPickerVisible}
              options={THRESHOLD_OPTIONS}
              selected={String(settings.expirationDaysThreshold)}
              onSelect={value => {
                handleSettingChange('expirationDaysThreshold', Number(value));
                setThresholdPickerVisible(false);
              }}
              onCancel={() => setThresholdPickerVisible(false)}
            />
          </>
        )}

        {renderSettings(
          PANTRY_SETTINGS,
          settings,
          hasPermission,
          updating,
          handleSettingChange,
        )}
      </SettingSection>

      <SettingSection title="Shopping List Notifications">
        {renderSettings(
          SHOPPING_SETTINGS,
          settings,
          hasPermission,
          updating,
          handleSettingChange,
        )}
      </SettingSection>

      <SettingSection title="Collaboration & Home">
        {renderSettings(
          SOCIAL_SETTINGS,
          settings,
          hasPermission,
          updating,
          handleSettingChange,
        )}
      </SettingSection>

      <SettingSection title="Recipes & Meal Planning">
        {renderSettings(
          RECIPE_SETTINGS,
          settings,
          hasPermission,
          updating,
          handleSettingChange,
        )}
      </SettingSection>

      <SettingSection title="Digests & Reports">
        {renderSettings(
          DIGEST_SETTINGS,
          settings,
          hasPermission,
          updating,
          handleSettingChange,
        )}
      </SettingSection>

      <SettingSection title="Quiet Hours">
        {renderSettings(
          QUIET_HOURS_SETTINGS,
          settings,
          hasPermission,
          updating,
          handleSettingChange,
        )}
        {!!settings.quietHoursEnabled && (
          <View style={styles.quietHoursInfo}>
            <Text size="md" weight="medium" style={styles.quietHoursText}>
              Quiet hours: {settings.quietHoursStart || '22:00'} -{' '}
              {settings.quietHoursEnd || '08:00'}
            </Text>
            <Text size="sm" tone="secondary">
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
    </ProfileScreenWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quietTimeAlert: {
    backgroundColor: theme.colors.info + '20',
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.info,
  },
  quietTimeText: {
    color: theme.colors.info,
  },
  settingLabel: {
    marginBottom: theme.spacing.xs,
  },
  pickerRow: {
    marginLeft: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    marginBottom: theme.spacing.sm,
  },
  pickerValue: {
    marginTop: theme.spacing.xs,
  },
  quietHoursInfo: {
    marginLeft: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    marginBottom: theme.spacing.sm,
  },
  quietHoursText: {
    marginBottom: theme.spacing.xs,
  },
}));

export default NotificationSettingsScreen;
