import React, { useState, useEffect, useRef } from 'react';
import { errorService } from '#/services/errorService';
import { View, Platform, Linking, AppState } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { authService } from '#/services/authService';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { useNavigation } from '@react-navigation/native';
import { SettingSwitch } from '#components/settings/SettingSwitch';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import {
  useNotificationSettings,
  type NotificationSettings,
} from '#features/notifications/hooks/useNotificationSettings';
import { useNotificationPermissions } from '#features/notifications/hooks/useNotificationPermissions';
import { useNotificationSync } from '#features/notifications/hooks/useNotificationSync';
import { ExpirationFrequency } from '#/graphql/generated/schemaTypes';
import { ModalPicker } from '#components/molecules/ModalPicker';
import { AlertBanner } from '#components/molecules/AlertBanner';
import {
  executeWithLoadingState,
  executeWriteWithFinally,
} from '#/utils/finallyHelpers';
import { logger } from '#/utils/environment';
import { Text } from '#components/atoms/Text';

interface SettingDef {
  key: keyof NotificationSettings;
  titleKey: string;
  descriptionKey: string;
}

const CHANNEL_SETTINGS: SettingDef[] = [
  {
    key: 'pushEnabled',
    titleKey: 'notifications.pushNotifications',
    descriptionKey: 'notifications.pushNotificationsDesc',
  },
  {
    key: 'emailEnabled',
    titleKey: 'notifications.emailNotifications',
    descriptionKey: 'notifications.emailNotificationsDesc',
  },
  {
    key: 'smsEnabled',
    titleKey: 'notifications.smsNotifications',
    descriptionKey: 'notifications.smsNotificationsDesc',
  },
];

const PANTRY_SETTINGS: SettingDef[] = [
  {
    key: 'lowStockAlerts',
    titleKey: 'notifications.lowStockAlerts',
    descriptionKey: 'notifications.lowStockAlertsDesc',
  },
  {
    key: 'pantryChanges',
    titleKey: 'notifications.pantryUpdates',
    descriptionKey: 'notifications.pantryUpdatesDesc',
  },
];

const SHOPPING_SETTINGS: SettingDef[] = [
  {
    key: 'shoppingListUpdates',
    titleKey: 'notifications.listUpdates',
    descriptionKey: 'notifications.listUpdatesDesc',
  },
  {
    key: 'sharedListUpdates',
    titleKey: 'notifications.sharedListUpdates',
    descriptionKey: 'notifications.sharedListUpdatesDesc',
  },
];

const SOCIAL_SETTINGS: SettingDef[] = [
  {
    key: 'collaborationInvites',
    titleKey: 'notifications.collaborationInvites',
    descriptionKey: 'notifications.collaborationInvitesDesc',
  },
  {
    key: 'homeInvites',
    titleKey: 'notifications.homeInvitations',
    descriptionKey: 'notifications.homeInvitationsDesc',
  },
];

const RECIPE_SETTINGS: SettingDef[] = [
  {
    key: 'recipeRecommendations',
    titleKey: 'notifications.recipeRecommendations',
    descriptionKey: 'notifications.recipeRecommendationsDesc',
  },
  {
    key: 'mealPlanReminders',
    titleKey: 'notifications.mealPlanReminders',
    descriptionKey: 'notifications.mealPlanRemindersDesc',
  },
  {
    key: 'cookingReminders',
    titleKey: 'notifications.cookingReminders',
    descriptionKey: 'notifications.cookingRemindersDesc',
  },
];

const DIGEST_SETTINGS: SettingDef[] = [
  {
    key: 'weeklyDigest',
    titleKey: 'labels.weeklyDigest',
    descriptionKey: 'notifications.weeklyDigestDesc',
  },
  {
    key: 'monthlyReport',
    titleKey: 'notifications.monthlyReport',
    descriptionKey: 'notifications.monthlyReportDesc',
  },
];

const QUIET_HOURS_SETTINGS: SettingDef[] = [
  {
    key: 'quietHoursEnabled',
    titleKey: 'notifications.enableQuietHours',
    descriptionKey: 'notifications.enableQuietHoursDesc',
  },
];

const getFrequencyOptions = (t: Translate) => [
  {
    label: t('notifications.frequencyRealTime'),
    value: ExpirationFrequency.RealTime,
  },
  {
    label: t('notifications.frequencyDailyMorning'),
    value: ExpirationFrequency.DailyMorning,
  },
  {
    label: t('notifications.frequencyDailyEvening'),
    value: ExpirationFrequency.DailyEvening,
  },
  {
    label: t('labels.weeklyDigest'),
    value: ExpirationFrequency.WeeklyDigest,
  },
  {
    label: t('labels.never'),
    value: ExpirationFrequency.Never,
  },
];

const getThresholdOptions = (t: Translate) => [
  { label: t('notifications.thresholdSameDay'), value: '0' },
  { label: t('notifications.thresholdNDaysBefore', { n: 1 }), value: '1' },
  {
    label: t('notifications.thresholdNDaysBeforePlural', { n: 2 }),
    value: '2',
  },
  {
    label: t('notifications.thresholdNDaysBeforePlural', { n: 3 }),
    value: '3',
  },
  {
    label: t('notifications.thresholdNDaysBeforePlural', { n: 5 }),
    value: '5',
  },
  {
    label: t('notifications.thresholdNDaysBeforePlural', { n: 7 }),
    value: '7',
  },
];

/**
 * No `loading` prop: `SettingSwitch` forwards it to `disabled`, and disabling a
 * switch the user has just flipped drops the taps that land while the mutation
 * is in flight — seconds, when the API is unreachable. Nothing waits on that
 * request any more: the change is written to the cache before firing and queued
 * for replay, so the switch reflects it immediately either way. The action rows
 * (send test / reset) keep `loading`, where it debounces a one-shot command.
 */
const renderSettings = (
  defs: SettingDef[],
  settings: NotificationSettings,
  handleSettingChange: (
    key: keyof NotificationSettings,
    value: boolean | string | number | ExpirationFrequency,
  ) => void,
  t: Translate,
) =>
  defs.map(({ key, titleKey, descriptionKey }) => (
    <SettingSwitch
      key={key}
      testID={`notification-switch-${key}`}
      title={t(titleKey)}
      description={t(descriptionKey)}
      value={!!settings[key]}
      onValueChange={v => handleSettingChange(key, v)}
    />
  ));

export const NotificationSettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const FREQUENCY_OPTIONS = getFrequencyOptions(t);
  const THRESHOLD_OPTIONS = getThresholdOptions(t);
  const { addListener } = useNavigation();
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
  const { syncSendTest } = useNotificationSync();

  const handleSendTest = async () => {
    setUpdating('test');
    const ok = await syncSendTest();
    setUpdating(null);
    alertService.alert(
      ok
        ? t('notifications.testSentTitle')
        : t('notifications.testFailedTitle'),
      ok
        ? t('notifications.testSentMessage')
        : t('notifications.testFailedMessage'),
    );
  };

  const appState = useRef(AppState.currentState);

  // Check permission status when screen comes into focus
  useEffect(() => {
    const checkPermsOnFocus = addListener('focus', () => {
      checkPermissions();
    });

    return checkPermsOnFocus;
  }, [addListener, checkPermissions]);

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
              t('notifications.permissionRequiredTitle'),
              t('notifications.permissionRequiredMessage'),
              [
                { text: t('labels.cancel'), style: 'cancel' },
                {
                  text: t('labels.openSettings'),
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
              t('labels.error'),
              t('notifications.updateFailed'),
            );
            return;
          }

          // Permission was just granted here (the login flow no longer prompts),
          // so re-register the device to deliver the now-available push token to
          // the server.
          authService.registerDeviceInBackground();
        },
        isLoading => setUpdating(isLoading ? key : null),
        error => {
          errorService.reportError(error, {
            operation: 'requestNotificationPermission',
          });
          alertService.alert(
            t('errors.permissionTitle'),
            t('notifications.permissionErrorMessage'),
          );
        },
      );
      return;
    }

    // Default handling for all other settings. The `!success` branch covers a
    // resolved refusal; `onError` covers a throw, which the finalizer would
    // otherwise swallow — same copy, so one failure produces one message
    // whichever route it took.
    executeWriteWithFinally(
      async () => {
        const success = await updateNotificationSetting(key, value);
        if (!success) {
          alertService.alert(
            t('labels.error'),
            t('notifications.updateFailed'),
          );
        }
      },
      isLoading => setUpdating(isLoading ? key : null),
      error => {
        logger.error('Notification setting update threw', { key, error });
        alertService.alert(t('labels.error'), t('notifications.updateFailed'));
      },
    );
  };

  const handleResetToDefaults = () => {
    alertService.alert(
      t('settings.resetToDefaults'),
      t('notifications.resetConfirm'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('settings.resetSection'),
          style: 'destructive',
          onPress: () => {
            executeWriteWithFinally(
              async () => {
                const success = await resetToDefaults();
                if (success) {
                  alertService.alert(
                    t('labels.success'),
                    t('notifications.resetSuccess'),
                  );
                } else {
                  alertService.alert(
                    t('labels.error'),
                    t('errors.resetSettingsFailed'),
                  );
                }
              },
              isLoading => setUpdating(isLoading ? 'reset' : null),
              error => {
                logger.error('Notification settings reset threw', { error });
                alertService.alert(
                  t('labels.error'),
                  t('errors.resetSettingsFailed'),
                );
              },
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
          {t('settings.loadingSettings')}
        </Text>
      </View>
    );
  }

  return (
    <ProfileScreenWrapper title={t('notifications.title')}>
      {/* Quiet Hours Status */}
      {isQuietTime() && (
        <View style={styles.quietTimeAlert}>
          <Text size="sm" align="center" style={styles.quietTimeText}>
            {t('notifications.quietHoursActive')}
          </Text>
        </View>
      )}

      {/* Permission Status Banner */}
      {hasPermission === false && !!settings.pushEnabled && (
        <AlertBanner
          title={t('notifications.disabledTitle')}
          subtitle={t('notifications.disabledSubtitle')}
          icon="notifications-off"
          iconLibrary="Ionicons"
          variant="warning"
          onPress={() => {
            alertService.alert(
              t('notifications.enableTitle'),
              t('notifications.enableMessage'),
              [
                { text: t('labels.cancel'), style: 'cancel' },
                {
                  text: t('labels.openSettings'),
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

      <SettingsSection variant="inset" title={t('notifications.general')}>
        {renderSettings(CHANNEL_SETTINGS, settings, handleSettingChange, t)}
      </SettingsSection>

      <SettingsSection variant="inset" title={t('notifications.pantry')}>
        <SettingSwitch
          title={t('notifications.expirationAlerts')}
          description={t('notifications.expirationAlertsDesc')}
          value={settings.expirationNotifications}
          onValueChange={value =>
            handleSettingChange('expirationNotifications', value)
          }
        />

        {!!settings.expirationNotifications && (
          <>
            <AppPressable
              haptic
              style={styles.pickerRow}
              onPress={() => setFrequencyPickerVisible(true)}
            >
              <Text size="sm" weight="medium" style={styles.settingLabel}>
                {t('notifications.notificationFrequency')}
              </Text>
              <Text size="sm" tone="accent" style={styles.pickerValue}>
                {FREQUENCY_OPTIONS.find(
                  o => o.value === settings.expirationNotificationFrequency,
                )?.label ?? t('labels.select')}
              </Text>
            </AppPressable>
            <ModalPicker
              label={t('notifications.notificationFrequency')}
              visible={frequencyPickerVisible}
              options={FREQUENCY_OPTIONS}
              selected={settings.expirationNotificationFrequency}
              onSelect={value => {
                handleSettingChange('expirationNotificationFrequency', value);
                setFrequencyPickerVisible(false);
              }}
              onCancel={() => setFrequencyPickerVisible(false)}
            />

            <AppPressable
              haptic
              style={styles.pickerRow}
              onPress={() => setThresholdPickerVisible(true)}
            >
              <Text size="sm" weight="medium" style={styles.settingLabel}>
                {t('notifications.alertThreshold')}
              </Text>
              <Text size="sm" tone="accent" style={styles.pickerValue}>
                {THRESHOLD_OPTIONS.find(
                  o => o.value === String(settings.expirationDaysThreshold),
                )?.label ?? t('labels.select')}
              </Text>
            </AppPressable>
            <ModalPicker
              label={t('notifications.alertThreshold')}
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

        {renderSettings(PANTRY_SETTINGS, settings, handleSettingChange, t)}
      </SettingsSection>

      <SettingsSection variant="inset" title={t('notifications.shopping')}>
        {renderSettings(SHOPPING_SETTINGS, settings, handleSettingChange, t)}
      </SettingsSection>

      <SettingsSection variant="inset" title={t('notifications.social')}>
        {renderSettings(SOCIAL_SETTINGS, settings, handleSettingChange, t)}
      </SettingsSection>

      <SettingsSection
        variant="inset"
        title={t('notifications.recipesMealPlanning')}
      >
        {renderSettings(RECIPE_SETTINGS, settings, handleSettingChange, t)}
      </SettingsSection>

      <SettingsSection
        variant="inset"
        title={t('notifications.digestsReports')}
      >
        {renderSettings(DIGEST_SETTINGS, settings, handleSettingChange, t)}
      </SettingsSection>

      <SettingsSection variant="inset" title={t('notifications.quietHours')}>
        {renderSettings(QUIET_HOURS_SETTINGS, settings, handleSettingChange, t)}
        {!!settings.quietHoursEnabled && (
          <View style={styles.quietHoursInfo}>
            <Text size="md" weight="medium" style={styles.quietHoursText}>
              {t('notifications.quietHoursLabel', {
                start: settings.quietHoursStart || '22:00',
                end: settings.quietHoursEnd || '08:00',
              })}
            </Text>
            <Text size="sm" tone="secondary">
              {t('notifications.quietHoursSubtitle')}
            </Text>
          </View>
        )}
      </SettingsSection>

      <SettingsSection variant="inset" title={t('notifications.testSection')}>
        <SettingSwitch
          title={t('notifications.sendTestNotification')}
          description={t('notifications.sendTestNotificationDesc')}
          value={false}
          onValueChange={handleSendTest}
          loading={updating === 'test'}
        />
      </SettingsSection>

      <SettingsSection variant="inset" title={t('settings.resetSection')}>
        <SettingSwitch
          title={t('settings.resetToDefaults')}
          description={t('notifications.resetToDefaultsDesc')}
          value={false}
          onValueChange={handleResetToDefaults}
          loading={updating === 'reset'}
        />
      </SettingsSection>
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
    marginBottom: theme.spacing.sm,
  },
  quietHoursText: {
    marginBottom: theme.spacing.xs,
  },
}));

export default NotificationSettingsScreen;
