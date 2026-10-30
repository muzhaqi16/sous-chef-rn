import { useEffect } from 'react';
import { useMirroredSettings, useUser } from '#store/useAppStore';
import { useStore } from '#store';
import { skipToken, useQuery } from '@apollo/client/react';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { AppTheme, UnitSystem } from '#/graphql/generated/schemaTypes';
import { MIRRORED_SETTINGS, type SettingValues } from '#/domain/serverSettings';
import { useUpdateSettings } from '#hooks/settings/useUpdateSettings';
import { useTranslation } from '#/i18n';

export type AppSettings = SettingValues;

/** What a user with no settings row reads: the server's defaults. */
const DEFAULT_SETTINGS: AppSettings = {
  theme: AppTheme.System,
  compactMode: false,
  autoSync: true,
  offlineMode: false,
  preferredUnitSystem: UnitSystem.System,
  ...MIRRORED_SETTINGS,
};

export const useAppSettings = () => {
  const { t } = useTranslation();
  const user = useUser();
  const { data, loading, error, refetch } = useQuery(
    GetUserSettingsDocument,
    user?.id ? {} : skipToken,
  );
  const { updateSettings } = useUpdateSettings();

  const settings = data?.me?.settings;
  const mirrored = useMirroredSettings();

  // The server's answer once read; before it, the store's mirror of it.
  const current: AppSettings = settings ?? { ...DEFAULT_SETTINGS, ...mirrored };

  /** Single-key convenience over {@link useUpdateSettings}. */
  const updateAppSetting = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => updateSettings({ [key]: value });

  const resetToDefaults = async () => {
    const defaultSettings: Partial<AppSettings> = {
      theme: AppTheme.System,
      compactMode: false,
      showTutorials: true,
      autoSync: true,
      offlineMode: false,
      preferredUnitSystem: UnitSystem.System,
    };

    return updateSettings(defaultSettings, t('errors.resetSettingsFailed'));
  };

  // Offline mode renders from the store; the server copy follows the device's
  // last choice to the account's other devices.
  useEffect(() => {
    if (settings?.offlineMode !== undefined) {
      useStore.getState().setOfflineModeEnabled(settings.offlineMode);
    }
  }, [settings?.offlineMode]);

  return {
    settings: current,
    loading,
    // `settings` is never empty (defaults fill every field), so it
    // cannot say whether the server replied; gating on `loading` blanks the
    // screen on every mount, since Apollo reports it true on each one.
    hasLoadedSettings: !!settings,
    // Failures RESOLVE under the global `errorPolicy: 'all'`.
    error,
    updateAppSetting,
    resetToDefaults,
    refetch,
  };
};
