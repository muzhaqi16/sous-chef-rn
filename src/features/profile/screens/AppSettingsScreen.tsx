import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { SettingSwitch } from '#components/settings/SettingSwitch';
import { SettingSection } from '#components/settings/SettingSection';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import {
  useAppSettings,
  type AppSettings,
} from '#features/profile/hooks/useAppSettings';
import { UnitSystem } from '#/graphql/generated/schemaTypes';
import { Picker } from '@react-native-picker/picker';

const ThemedPickerItem = withUnistyles(Picker.Item, theme => ({
  color: theme.colors.textPrimary,
}));
import { commonStyles } from '#/styles/commonStyles';
import { useAppStore, useShowNavigationLabels } from '#store/useAppStore';
import { useStore } from '#store';
import { resetAllFeatureHints } from '#hooks/useFeatureHint';
import { useUserPreferences } from '#hooks/settings/useUserPreferences';
import { executeAsyncWithCleanup } from '#/utils/finallyHelpers';
import { Telemetry } from '#services/telemetry';
import { Text } from '#components/atoms/Text';

export const AppSettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const [updating, setUpdating] = useState<string | null>(null);

  const { settings, loading, updateAppSetting, resetToDefaults } =
    useAppSettings();

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
   * No `loading` on the switches: `SettingSwitch` forwards it to `disabled`, so
   * the control went dead on the frame after the tap and every tap landing in
   * that window was dropped — which is what "takes two taps" was. Nothing waits
   * on the request now: the change is written to the cache before firing and
   * queues for replay if the API is unreachable. `updating` is still tracked for
   * the reset row, where it debounces a one-shot command.
   */
  const handleSettingChange = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    setUpdating(key);
    // No alert here: `updateAppSetting` is the single alerter for its own
    // failure (see `alertIfRejected`'s contract). Alerting again on `!success`
    // stacked a second dialog on every failed toggle.
    executeAsyncWithCleanup(
      () => updateAppSetting(key, value),
      () => setUpdating(null),
    );
  };

  /**
   * Offline mode applies locally first, then mirrors to the server. The local
   * write is the one that matters: it drives the link policy and persists to
   * MMKV, and it must not depend on a round-trip that is unavailable precisely
   * when the user reaches for this switch. The mirror rides `localFirst`, so an
   * unreachable API queues it for replay rather than failing it.
   *
   * `immediate` on the store write: this is the one caller that IS a user
   * gesture, so the offline banner should announce it without the dwell/hold
   * those debounces exist to absorb flapping, and a switch isn't flapping.
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

  if (loading) {
    return (
      <View style={commonStyles.loadingContainer}>
        <Text style={commonStyles.loadingText}>
          {t('settings.loadingSettings')}
        </Text>
      </View>
    );
  }

  return (
    <ProfileScreenWrapper
      title={t('labels.appSettings')}
      testID="settings-screen"
    >
      <SettingSection title={t('settings.unitsSection')}>
        <View style={styles.pickerContainer}>
          <Text style={commonStyles.subtitle}>
            {t('settings.preferredUnitSystem')}
          </Text>
          <Picker
            testID="settings-unit-system-picker"
            selectedValue={settings.preferredUnitSystem}
            onValueChange={value =>
              handleSettingChange('preferredUnitSystem', value)
            }
            style={styles.picker}
          >
            <ThemedPickerItem
              label={t('settings.unitMetric')}
              value={UnitSystem.Metric}
            />
            <ThemedPickerItem
              label={t('settings.unitImperial')}
              value={UnitSystem.Imperial}
            />
            <ThemedPickerItem
              label={t('settings.unitSystemDefault')}
              value={UnitSystem.System}
            />
          </Picker>
        </View>
      </SettingSection>

      <SettingSection title={t('settings.syncOffline')}>
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
      </SettingSection>

      <SettingSection title={t('settings.features')}>
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
      </SettingSection>

      <SettingSection title={t('settings.experience')}>
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
      </SettingSection>

      <SettingSection title={t('settings.resetSection')}>
        <SettingSwitch
          title={t('settings.resetToDefaults')}
          description={t('settings.resetToDefaultsDesc')}
          value={false}
          onValueChange={handleResetToDefaults}
          loading={updating === 'reset'}
        />
      </SettingSection>
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
