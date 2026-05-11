import { useEffect } from 'react';
import { useUser } from '#store/useAppStore';
import { useStore } from '#store';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  GetUserSettingsDocument,
  UpdateUserPreferencesDocument,
} from '#operations/auth/user.generated';
import {
  AppTheme,
  UnitSystem,
  type UpdateUserSettingsInput,
} from '#/graphql/generated/schemaTypes';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { storage } from '#/storage/mmkv';

export interface AppSettings {
  theme: AppTheme;
  compactMode: boolean;
  showTutorials: boolean;
  autoSync: boolean;
  offlineMode: boolean;
  preferredUnitSystem: UnitSystem;
  enabledFeatures: string[];
  betaFeatures: string[];
}

export const useAppSettings = () => {
  const user = useUser();
  const { data, loading, refetch } = useQuery(GetUserSettingsDocument, {
    skip: !user?.id,
  });
  const [updateSettings] = useMutation(UpdateUserPreferencesDocument);

  const settings = data?.me?.settings;

  const getAppSettings = (): AppSettings => {
    return {
      theme: settings?.theme || AppTheme.System,
      compactMode: settings?.compactMode ?? false,
      showTutorials: settings?.showTutorials ?? true,
      autoSync: settings?.autoSync ?? true,
      offlineMode: settings?.offlineMode ?? false,
      preferredUnitSystem: settings?.preferredUnitSystem || UnitSystem.Metric,
      enabledFeatures: settings?.enabledFeatures || [],
      betaFeatures: settings?.betaFeatures || [],
    };
  };

  const toSettingsInput = (
    updates: Partial<AppSettings>,
  ): UpdateUserSettingsInput => {
    const input: UpdateUserSettingsInput = {};
    if (
      'theme' in updates ||
      'compactMode' in updates ||
      'showTutorials' in updates
    ) {
      input.ui = {};
      if ('theme' in updates) input.ui.theme = updates.theme;
      if ('compactMode' in updates) input.ui.compactMode = updates.compactMode;
      if ('showTutorials' in updates)
        input.ui.showTutorials = updates.showTutorials;
    }
    if ('autoSync' in updates || 'offlineMode' in updates) {
      input.sync = {};
      if ('autoSync' in updates) input.sync.autoSync = updates.autoSync;
      if ('offlineMode' in updates)
        input.sync.offlineMode = updates.offlineMode;
    }
    if ('preferredUnitSystem' in updates) {
      input.regional = { preferredUnitSystem: updates.preferredUnitSystem };
    }
    if ('enabledFeatures' in updates || 'betaFeatures' in updates) {
      input.features = {};
      if ('enabledFeatures' in updates)
        input.features.enabledFeatures = updates.enabledFeatures;
      if ('betaFeatures' in updates)
        input.features.betaFeatures = updates.betaFeatures;
    }
    return input;
  };

  const updateAppSetting = async (key: keyof AppSettings, value: any) => {
    const input = toSettingsInput({ [key]: value } as Partial<AppSettings>);
    const result = await executeMutation(
      () => updateSettings({ variables: { input } }),
      'Failed to update app setting',
    );
    return result !== false;
  };

  const updateMultipleSettings = async (updates: Partial<AppSettings>) => {
    const input = toSettingsInput(updates);
    const result = await executeMutation(
      () => updateSettings({ variables: { input } }),
      'Failed to update app settings',
    );
    return result !== false;
  };

  const resetToDefaults = async () => {
    const defaultSettings: Partial<AppSettings> = {
      theme: AppTheme.System,
      compactMode: false,
      showTutorials: true,
      autoSync: true,
      offlineMode: false,
      preferredUnitSystem: UnitSystem.Metric,
    };

    return updateMultipleSettings(defaultSettings);
  };

  const memoizedSettings = getAppSettings();

  // PERFORMANCE: Sync settings to MMKV so startup-path hooks can read them
  // without triggering the GetUserSettings GraphQL query at startup.
  // - useShowTutorials reads 'user_show_tutorials' from MMKV
  // - offlineModeEnabled is mirrored to MMKV by networkSlice.setOfflineModeEnabled
  useEffect(() => {
    if (settings?.showTutorials !== undefined) {
      storage.set('user_show_tutorials', settings.showTutorials);
    }
    if (settings?.offlineMode !== undefined) {
      useStore.getState().setOfflineModeEnabled(settings.offlineMode);
    }
  }, [settings?.showTutorials, settings?.offlineMode]);

  return {
    settings: memoizedSettings,
    loading,
    updateAppSetting,
    updateMultipleSettings,
    resetToDefaults,
    refetch,
  };
};
