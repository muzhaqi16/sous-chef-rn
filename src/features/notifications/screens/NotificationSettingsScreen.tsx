import React, { useState } from 'react';
import { errorService } from '#/services/errorService';
import { View, Platform, Linking } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { authService } from '#/services/authService';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';

import { SettingSwitch } from '#components/molecules/SettingSwitch';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { SubScreen } from '#components/templates/SubScreen';
import {
  useNotificationSettings,
  type NotificationSettings,
} from '#features/notifications/hooks/useNotificationSettings';
import { useNotificationPermissions } from '#features/notifications/hooks/useNotificationPermissions';
import { useResyncPermissionOnReturn } from '#features/notifications/hooks/useResyncPermissionOnReturn';
import {
  CHANNEL_SETTINGS,
  PANTRY_SETTINGS,
  SHOPPING_SETTINGS,
  SOCIAL_SETTINGS,
  RECIPE_SETTINGS,
  DIGEST_SETTINGS,
  QUIET_HOURS_SETTINGS,
  getFrequencyOptions,
  getThresholdOptions,
  type SettingDef,
} from '#features/notifications/utils/notificationSettingsConfig';
import type { ExpirationFrequency } from '#/graphql/generated/schemaTypes';
import { useDataState } from '#hooks/data/useDataState';
import { DataStateView } from '#components/organisms/DataStateView';
import { ModalPicker } from '#components/molecules/ModalPicker';
import { AlertBanner } from '#components/molecules/AlertBanner';
import {
  executeWithLoadingState,
  executeWriteWithFinally,
} from '#/utils/finallyHelpers';
import { logger } from '#/utils/environment';
import { Text } from '#components/atoms/Text';
import { notificationsTestIDs } from '#features/notifications/testIDs';

/**
 * No `loading` prop: `SettingSwitch` forwards it to `disabled`, which drops taps
 * landing while the mutation is in flight. Nothing waits on it — the change is
 * cached before firing and queued for replay. The action rows keep `loading`,
 * where it debounces a one-shot command.
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
      testID={notificationsTestIDs.settingSwitch(key)}
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
  const [updating, setUpdating] = useState<string | null>(null);
  const [frequencyPickerVisible, setFrequencyPickerVisible] = useState(false);
  const [thresholdPickerVisible, setThresholdPickerVisible] = useState(false);
  const { hasPermission, requestPermissions, checkPermissions } =
    useNotificationPermissions();

  const {
    settings,
    loading,
    hasPreferences,
    skipped,
    error,
    refetch,
    updateNotificationSetting,
    resetToDefaults,
    isQuietTime,
  } = useNotificationSettings();

  // `settings` always has a value (defaults are filled in), so availability has
  // to come from `hasPreferences`.
  const dataState = useDataState({
    loading,
    error,
    hasResult: hasPreferences,
    isEmpty: false,
    skipped,
  });

  useResyncPermissionOnReturn({
    checkPermissions,
    hasPermission,
    pushEnabled: settings.pushEnabled,
  });

  const handleSettingChange = (
    key: keyof NotificationSettings,
    value: boolean | string | number | ExpirationFrequency,
  ) => {
    // Special handling for push notification toggle
    if (key === 'pushEnabled' && value === true) {
      void executeWithLoadingState(
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
                      void Linking.openURL('app-settings:').catch(error =>
                        logger.warn(
                          'Opening the system settings failed',
                          error,
                        ),
                      );
                    } else {
                      void Linking.openSettings().catch(error =>
                        logger.warn(
                          'Opening the system settings failed',
                          error,
                        ),
                      );
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

          // This is where permission is granted (the login flow does not
          // prompt), so re-register to deliver the push token to the server.
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
    void executeWriteWithFinally(
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
            void executeWriteWithFinally(
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

  // Inside the wrapper so the back button survives: the screen has to be
  // leavable while it waits.
  if (dataState !== 'ready') {
    return (
      <SubScreen title={t('notifications.title')} scroll="none">
        <DataStateView
          state={dataState}
          onRetry={() => {
            void refetch().catch(error =>
              errorService.reportError(error, {
                operation: 'NotificationSettings.retry',
              }),
            );
          }}
          testID={notificationsTestIDs.settingsState}
        />
      </SubScreen>
    );
  }

  return (
    <SubScreen title={t('notifications.title')}>
      {/* Quiet Hours Status */}
      {isQuietTime() && (
        <View style={styles.quietTimeAlert}>
          <Text role="caption" align="center" style={styles.quietTimeText}>
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
                      void Linking.openURL('app-settings:').catch(error =>
                        logger.warn(
                          'Opening the system settings failed',
                          error,
                        ),
                      );
                    } else {
                      void Linking.openSettings().catch(error =>
                        logger.warn(
                          'Opening the system settings failed',
                          error,
                        ),
                      );
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
          testID={notificationsTestIDs.settingSwitch('expirationNotifications')}
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
              <Text role="label" style={styles.settingLabel}>
                {t('notifications.notificationFrequency')}
              </Text>
              <Text role="caption" tone="accent" style={styles.pickerValue}>
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
              <Text role="label" style={styles.settingLabel}>
                {t('notifications.alertThreshold')}
              </Text>
              <Text role="caption" tone="accent" style={styles.pickerValue}>
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
            <Text role="bodyStrong" style={styles.quietHoursText}>
              {t('notifications.quietHoursLabel', {
                start: settings.quietHoursStart || '22:00',
                end: settings.quietHoursEnd || '08:00',
              })}
            </Text>
            <Text role="caption" tone="secondary">
              {t('notifications.quietHoursSubtitle')}
            </Text>
          </View>
        )}
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
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  quietTimeAlert: {
    backgroundColor: theme.colors.info + '20',
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    borderLeftWidth: theme.borderWidth.heavy,
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
