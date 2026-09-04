import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { StyleSheet } from 'react-native-unistyles';
import { SettingSwitch } from '#components/molecules/SettingSwitch';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import {
  useAppSettings,
  type AppSettings,
} from '#features/profile/hooks/useAppSettings';
import { UnitSystem } from '#/graphql/generated/schemaTypes';
import { ModalPicker } from '#components/molecules/ModalPicker';
import { AppPressable } from '#components/atoms/AppPressable';
import { commonStyles } from '#/styles/commonStyles';
import { useAppStore, useShowNavigationLabels } from '#store/useAppStore';
import { useStore } from '#store';
import { resetAllFeatureHints } from '#hooks/useFeatureHint';
import { useUserPreferences } from '#hooks/settings/useUserPreferences';
import { executeAsyncWithCleanup } from '#/utils/finallyHelpers';
import { Telemetry } from '#services/telemetry';
import { Text } from '#components/atoms/Text';
import { useDataState } from '#hooks/data/useDataState';
import { DataStateView } from '#components/organisms/DataStateView';

export const AppSettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const [updating, setUpdating] = useState<string | null>(null);
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);

  const {
    settings,
    loading,
    hasLoadedSettings,
    error,
    refetch,
    updateAppSetting,
    resetToDefaults,
  } = useAppSettings();

  // `settings` always has a value (defaults are filled in), so availability has
  // to come from `hasLoadedSettings`.
  const dataState = useDataState({
    loading,
    error,
    hasResult: hasLoadedSettings,
    isEmpty: false,
  });

  // Offline mode renders from the STORE, not from `settings`. The store is what
  // actually drives the policy (`offlineModeLink` reads it, and it's the value
  // mirrored to MMKV) — the server copy is a cross-device mirror. Binding the
  // switch to the store makes the flip synchronous and independent of an Apollo
  // broadcast, which matters most in exactly the case where the server can't be
  // reached.
  const offlineModeEnabled = useAppStore(state => state.offlineModeEnabled);
  const setOfflineModeEnabled = useAppStore(
    state => state.setOfflineModeEnabled,
  );

  // PERFORMANCE: Use selective selectors instead of inline functions
  const hapticFeedbackEnabled = useAppStore(
    state => state.hapticFeedbackEnabled,
  );
  const setHapticFeedbackEnabled = useAppStore(
    state => state.setHapticFeedbackEnabled,
  );
  const showNavigationLabels = useShowNavigationLabels();
  const setShowNavigationLabels = useAppStore(
    state => state.setShowNavigationLabels,
  );

  // Per-user preferences
  const {
    preferences: userPrefs,
    updatePreference,
    resetPreferences: resetUserPreferences,
  } = useUserPreferences();

  // Telemetry consent
  const userConsent = useAppStore(state => state.userConsent);
  const setUserConsent = useAppStore(state => state.setUserConsent);

  const handleConsentChange = (consent: boolean) => {
    setUserConsent(consent);
    // Immediately update running telemetry service to respect new consent
    const config = useStore.getState().getTelemetryConfig();
    Telemetry.updateConfig(config);
  };

  /**
   * No `loading` on the switches: `SettingSwitch` forwards it to `disabled`,
   * which kills the control for a frame and drops the taps landing there.
   * Nothing waits on the request — the change is cached before firing and
   * queues for replay. `updating` is kept for the reset row, a one-shot command.
   */
  const handleSettingChange = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    setUpdating(key);
    // No alert here: `updateAppSetting` is the single alerter for its own
    // failure, and a second one on `!success` stacks two dialogs.
    executeAsyncWithCleanup(
      () => updateAppSetting(key, value),
      () => setUpdating(null),
    );
  };

  /**
   * The LOCAL write is the one that matters — it drives the link policy and
   * persists to MMKV, and cannot depend on a round-trip unavailable exactly
   * when this switch is reached for. `immediate` because this is the one caller
   * that IS a user gesture: a switch is not flapping, so no dwell is needed.
   */
  const handleOfflineModeChange = (value: boolean) => {
    setOfflineModeEnabled(value, true);
    setUpdating('offlineMode');
    executeAsyncWithCleanup(
      () => updateAppSetting('offlineMode', value),
      () => setUpdating(null),
    );
  };

  const handleResetToDefaults = () => {
    alertService.alert(
      t('settings.resetToDefaults'),
      t('settings.resetConfirm'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('settings.resetSection'),
          style: 'destructive',
          onPress: () => {
            setUpdating('reset');
            executeAsyncWithCleanup(
              async () => {
                const success = await resetToDefaults();
                // Also reset feature hints/tutorials and per-user preferences
                resetAllFeatureHints();
                resetUserPreferences();
                // Only the success path alerts — `resetToDefaults` already
                // surfaces its own failure with `errors.resetSettingsFailed`.
                if (success) {
                  alertService.alert(
                    t('labels.success'),
                    t('settings.resetSuccess'),
                  );
                }
              },
              () => setUpdating(null),
            );
          },
        },
      ],
    );
  };

  // In-app `ModalPicker`, NOT `@react-native-picker/picker`: on Android that
  // one's dropdown is a DIALOG themed from the Activity theme, so it follows
  // the OS `uiMode` and ignores the app's light/dark preference, unreachable
  // from RN. `Alert.alert` and the date pickers share the limit.
  const unitSystemOptions = [
    { label: t('settings.unitMetric'), value: UnitSystem.Metric },
    { label: t('settings.unitImperial'), value: UnitSystem.Imperial },
    { label: t('settings.unitSystemDefault'), value: UnitSystem.System },
  ];
  const selectedUnitLabel =
    unitSystemOptions.find(o => o.value === settings.preferredUnitSystem)
      ?.label ?? t('labels.select');

  // Inside the wrapper so the back button survives: the screen has to be
  // leavable while it waits.
  if (dataState !== 'ready') {
    return (
      <ProfileScreenWrapper
        title={t('labels.appSettings')}
        testID="settings-screen"
        scrollEnabled={false}
      >
        <DataStateView
          state={dataState}
          onRetry={() => {
            refetch();
          }}
          testID="settings-state"
        />
      </ProfileScreenWrapper>
    );
  }

  return (
    <ProfileScreenWrapper
      title={t('labels.appSettings')}
      testID="settings-screen"
    >
      <SettingsSection variant="inset" title={t('settings.unitsSection')}>
        <AppPressable
          haptic
          testID="settings-unit-system-picker"
          style={styles.pickerContainer}
          onPress={() => setUnitPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t('settings.preferredUnitSystem')}
          accessibilityValue={{ text: selectedUnitLabel }}
        >
          <Text style={commonStyles.subtitle}>
            {t('settings.preferredUnitSystem')}
          </Text>
          <Text role="caption" tone="accent" style={styles.picker}>
            {selectedUnitLabel}
          </Text>
        </AppPressable>
        <ModalPicker
          label={t('settings.preferredUnitSystem')}
          visible={unitPickerVisible}
          options={unitSystemOptions}
          selected={settings.preferredUnitSystem}
          onSelect={value => {
            handleSettingChange('preferredUnitSystem', value as UnitSystem);
            setUnitPickerVisible(false);
          }}
          onCancel={() => setUnitPickerVisible(false)}
        />
      </SettingsSection>

      <SettingsSection variant="inset" title={t('settings.syncOffline')}>
        <SettingSwitch
          testID="settings-auto-sync-switch"
          title={t('settings.autoSync')}
          description={t('settings.autoSyncDesc')}
          value={settings.autoSync}
          onValueChange={value => handleSettingChange('autoSync', value)}
        />
        <SettingSwitch
          testID="settings-offline-mode-switch"
          title={t('settings.offlineMode')}
          description={t('settings.offlineModeDesc')}
          value={offlineModeEnabled}
          onValueChange={handleOfflineModeChange}
        />
      </SettingsSection>

      <SettingsSection variant="inset" title={t('settings.features')}>
        <SettingSwitch
          testID="settings-show-tutorials-switch"
          title={t('settings.showTutorials')}
          description={t('settings.showTutorialsDesc')}
          value={settings.showTutorials}
          onValueChange={value => handleSettingChange('showTutorials', value)}
        />

        {settings.betaFeatures.length > 0 && (
          <View style={styles.betaFeaturesContainer}>
            <Text style={commonStyles.subtitle}>
              {t('settings.betaFeaturesEnabled')}
            </Text>
            <View style={styles.chipContainer}>
              {settings.betaFeatures.map((feature, index) => (
                <View key={index} style={[commonStyles.chip, styles.betaChip]}>
                  <Text style={commonStyles.chipText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </SettingsSection>

      <SettingsSection variant="inset" title={t('settings.experience')}>
        <SettingSwitch
          testID="settings-haptic-feedback-switch"
          title={t('settings.hapticFeedback')}
          description={t('settings.hapticFeedbackDesc')}
          value={hapticFeedbackEnabled}
          onValueChange={setHapticFeedbackEnabled}
        />
        <SettingSwitch
          testID="settings-navigation-labels-switch"
          title={t('settings.navigationLabels')}
          description={t('settings.navigationLabelsDesc')}
          value={showNavigationLabels}
          onValueChange={setShowNavigationLabels}
        />
        <SettingSwitch
          testID="settings-show-shopping-list-images-switch"
          title={t('settings.shoppingListImages')}
          description={t('settings.shoppingListImagesDesc')}
          value={userPrefs.showShoppingListImages}
          onValueChange={value =>
            updatePreference({ showShoppingListImages: value })
          }
        />
        <SettingSwitch
          testID="settings-share-usage-data-switch"
          title={t('settings.shareUsageData')}
          description={t('settings.shareUsageDataDesc')}
          value={userConsent ?? true}
          onValueChange={handleConsentChange}
        />
      </SettingsSection>

      <SettingsSection variant="inset" title={t('settings.resetSection')}>
        <SettingSwitch
          title={t('settings.resetToDefaults')}
          description={t('settings.resetToDefaultsDesc')}
          value={false}
          onValueChange={handleResetToDefaults}
          loading={updating === 'reset'}
        />
      </SettingsSection>
    </ProfileScreenWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  pickerContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.sm,
  },
  picker: {
    marginTop: theme.spacing.sm,
  },
  betaFeaturesContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginTop: theme.spacing.sm,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  betaChip: {
    marginRight: 0,
    backgroundColor: theme.colors.warning + '20',
  },
}));

export default AppSettingsScreen;
