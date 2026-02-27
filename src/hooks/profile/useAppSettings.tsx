import {useEffect} from 'react';
import {useAppStore} from '#store/useAppStore';
import {
  useGetUserSettingsQuery,
  useUpdateUserPreferencesMutation,
  AppTheme,
  UnitSystem } from '#generated';
import {executeMutation} from '#/utils/compilerSafeWrappers';
import {storage} from '#/storage/mmkv';

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
  const user = useAppStore(state => state.user);
  const {data, loading, refetch} = useGetUserSettingsQuery({
    skip: !user?.id });
  const [updateSettings] = useUpdateUserPreferencesMutation();

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
      betaFeatures: settings?.betaFeatures || [] };
  };

  const updateAppSetting = async (key: keyof AppSettings, value: any) => {
      const result = await executeMutation(
        () => updateSettings({ variables: { input: {[key]: value} } }),
        'Failed to update app setting',
      );
      return result !== false;
    };

  const updateMultipleSettings = async (updates: Partial<AppSettings>) => {
      const result = await executeMutation(
        () => updateSettings({ variables: { input: updates } }),
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
      preferredUnitSystem: UnitSystem.Metric };

    return updateMultipleSettings(defaultSettings);
  };

  const memoizedSettings = getAppSettings();

  // PERFORMANCE: Sync settings to MMKV so startup-path hooks can read them
  // without triggering the GetUserSettings GraphQL query at startup.
  // - useShowTutorials reads 'user_show_tutorials' from MMKV
  // - useOfflineMode reads 'user_offline_mode' from MMKV
  useEffect(() => {
    if (settings?.showTutorials !== undefined) {
      storage.set('user_show_tutorials', settings.showTutorials);
    }
    if (settings?.offlineMode !== undefined) {
      storage.set('user_offline_mode', settings.offlineMode);
    }
  }, [settings?.showTutorials, settings?.offlineMode]);

  return {
    settings: memoizedSettings,
    loading,
    updateAppSetting,
    updateMultipleSettings,
    resetToDefaults,
    refetch };
};
