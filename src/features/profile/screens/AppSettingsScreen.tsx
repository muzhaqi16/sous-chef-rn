import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { StyleSheet } from 'react-native-unistyles';
import { SettingSwitch } from '#components/molecules/SettingSwitch';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { SubScreen } from '#components/templates/SubScreen';
import {
  useAppSettings,
  type AppSettings,
} from '#features/profile/hooks/useAppSettings';
import { UnitSystem } from '#/graphql/generated/schemaTypes';
import { ModalPicker } from '#components/molecules/ModalPicker';
import { AppPressable } from '#components/atoms/AppPressable';
import {
  useAppStore,
  useShowNavigationLabels,
  useUserId,
} from '#store/useAppStore';
import { useStore } from '#store';
import { replayTipsFor } from '#hooks/settings/useFeatureHint';
import { tutorialSession } from '#hooks/ui/tutorialSession';
import { useUserPreferences } from '#hooks/settings/useUserPreferences';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { executeAsyncWithCleanup } from '#/utils/finallyHelpers';
import { Telemetry } from '#services/telemetry';
import { Text } from '#components/atoms/Text';
import { useDataState } from '#hooks/data/useDataState';
import { DataStateView } from '#components/organisms/DataStateView';
import { profileTestIDs } from '#features/profile/testIDs';
import { useReceiptPhotoConsent } from '#features/receipts/hooks/useReceiptPhotoConsent';
import { destructiveConfirm } from '#/services/destructiveConfirm';

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
  const storeModeOffered = useFeatureFlag('storeMode');
  const budgetAndPricesOffered = useFeatureFlag('budgetAndPrices');

  const { consent: receiptPhotoConsent, setConsent: setReceiptPhotoConsent } =
    useReceiptPhotoConsent();

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
   * dropping taps for a frame, and the change is cached before it fires.
   * `updating` is kept for the reset row, a one-shot command.
   */
  const handleSettingChange = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    setUpdating(key);
    // No alert here: `updateAppSetting` is the single alerter for its own
    // failure, and a second one on `!success` stacks two dialogs.
    void executeAsyncWithCleanup(
      () => updateAppSetting(key, value),
      () => setUpdating(null),
    );
  };

  // This account only: others on the device keep their progress.
  const userId = useUserId();
  const handleReplayTips = () => {
    if (!userId) return;
    if (!settings.showTutorials) handleSettingChange('showTutorials', true);
    tutorialSession.replay();
    replayTipsFor(userId);
    toastService.success(t('settings.replayTipsDone'));
  };

  const handleResetToDefaults = () => {
    alertService.alert(
      t('settings.resetToDefaults'),
      t('settings.resetConfirm'),
      destructiveConfirm(t('settings.resetSection'), () => {
        setUpdating('reset');
        void executeAsyncWithCleanup(
          async () => {
            const success = await resetToDefaults();
            resetUserPreferences();
            // Only the success path speaks: `resetToDefaults` already
            // surfaces its own failure with `errors.resetSettingsFailed`.
            if (success) toastService.success(t('settings.resetSuccess'));
          },
          () => setUpdating(null),
        );
      }),
    );
  };

  // `ModalPicker`, NOT `@react-native-picker/picker`: on Android its dropdown is
  // an Activity-themed DIALOG that follows the OS `uiMode`, not the app's theme
  // (so do `Alert.alert` and the date pickers).
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
      <SubScreen
        title={t('labels.appSettings')}
        testID={profileTestIDs.settingsScreen}
        scroll="none"
      >
        <DataStateView
          state={dataState}
          onRetry={() => {
            // A failed retry lands in the query's `error`, which this view renders.
            refetch().catch(() => {});
          }}
          testID={profileTestIDs.settingsState}
        />
      </SubScreen>
    );
  }

  return (
    <SubScreen
      title={t('labels.appSettings')}
      testID={profileTestIDs.settingsScreen}
    >
      <SettingsSection variant="inset" title={t('settings.unitsSection')}>
        <AppPressable
          haptic
          testID={profileTestIDs.settingsUnitSystemPicker}
          style={styles.pickerContainer}
          onPress={() => setUnitPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t('settings.preferredUnitSystem')}
          accessibilityValue={{ text: selectedUnitLabel }}
        >
          <Text role="bodyStrong" tone="secondary">
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
            handleSettingChange('preferredUnitSystem', value);
            setUnitPickerVisible(false);
          }}
          onCancel={() => setUnitPickerVisible(false)}
        />
      </SettingsSection>

      <SettingsSection variant="inset" title={t('settings.features')}>
        <SettingSwitch
          testID={profileTestIDs.settingsShowTutorialsSwitch}
          title={t('settings.showTutorials')}
          description={t('settings.showTutorialsDesc')}
          value={settings.showTutorials}
          onValueChange={value => handleSettingChange('showTutorials', value)}
        />
        <AppPressable
          haptic
          testID={profileTestIDs.settingsReplayTips}
          style={styles.pickerContainer}
          onPress={handleReplayTips}
          accessibilityRole="button"
          accessibilityLabel={t('settings.replayTips')}
          accessibilityHint={t('settings.replayTipsDesc')}
        >
          <Text role="bodyStrong" tone="secondary">
            {t('settings.replayTips')}
          </Text>
          <Text role="caption" tone="secondary" style={styles.picker}>
            {t('settings.replayTipsDesc')}
          </Text>
        </AppPressable>
        <SettingSwitch
          testID={profileTestIDs.settingsReceiptPhotosSwitch}
          title={t('receipts.photoSetting.title')}
          description={t('receipts.photoSetting.description')}
          value={receiptPhotoConsent === 'granted'}
          onValueChange={value =>
            setReceiptPhotoConsent(value ? 'granted' : 'declined')
          }
        />
      </SettingsSection>

      <SettingsSection variant="inset" title={t('settings.experience')}>
        <SettingSwitch
          testID={profileTestIDs.settingsHapticFeedbackSwitch}
          title={t('settings.hapticFeedback')}
          description={t('settings.hapticFeedbackDesc')}
          value={hapticFeedbackEnabled}
          onValueChange={setHapticFeedbackEnabled}
        />
        <SettingSwitch
          testID={profileTestIDs.settingsNavigationLabelsSwitch}
          title={t('settings.navigationLabels')}
          description={t('settings.navigationLabelsDesc')}
          value={showNavigationLabels}
          onValueChange={setShowNavigationLabels}
        />
        <SettingSwitch
          testID={profileTestIDs.settingsShowShoppingListImagesSwitch}
          title={t('settings.shoppingListImages')}
          description={t('settings.shoppingListImagesDesc')}
          value={userPrefs.showShoppingListImages}
          onValueChange={value =>
            updatePreference({ showShoppingListImages: value })
          }
        />
        <SettingSwitch
          testID={profileTestIDs.settingsShareUsageDataSwitch}
          title={t('settings.shareUsageData')}
          description={t('settings.shareUsageDataDesc')}
          value={userConsent ?? true}
          onValueChange={handleConsentChange}
        />
      </SettingsSection>

      {storeModeOffered || budgetAndPricesOffered ? (
        <SettingsSection variant="inset" title={t('labels.shopping')}>
          {storeModeOffered ? (
            <SettingSwitch
              testID={profileTestIDs.settingsStoreModeSwitch}
              title={t('settings.storeMode')}
              description={t('settings.storeModeDesc')}
              value={settings.storeMode}
              onValueChange={value => handleSettingChange('storeMode', value)}
            />
          ) : null}
          {budgetAndPricesOffered ? (
            <SettingSwitch
              testID={profileTestIDs.settingsBudgetAndPricesSwitch}
              title={t('labels.budgetAndPrices')}
              description={t('settings.budgetAndPricesDesc')}
              value={settings.budgetAndPrices === true}
              onValueChange={value =>
                handleSettingChange('budgetAndPrices', value)
              }
            />
          ) : null}
        </SettingsSection>
      ) : null}

      <SettingsSection variant="inset" title={t('settings.resetSection')}>
        <SettingSwitch
          title={t('settings.resetToDefaults')}
          description={t('settings.resetToDefaultsDesc')}
          value={false}
          onValueChange={handleResetToDefaults}
          loading={updating === 'reset'}
        />
      </SettingsSection>
    </SubScreen>
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
}));

export default AppSettingsScreen;
