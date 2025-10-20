import {useCallback} from 'react';
import {useStore} from '#store';
import {
  useGetUserSettingsQuery,
  useUpdateUserPreferencesMutation,
  AppTheme,
  UnitSystem,
} from '#generated';

export interface AppSettings {
  theme: AppTheme;
  compactMode: boolean;
  showTutorials: boolean;
  autoSync: boolean;
  offlineMode: boolean;
  shareUsageData: boolean;
  shareWithPartners: boolean;
  personalizedAds: boolean;
  preferredUnitSystem: UnitSystem;
  enabledFeatures: string[];
  betaFeatures: string[];
}

export const useAppSettings = () => {
  const user = useStore(state => state.user);
  const {data, loading, refetch} = useGetUserSettingsQuery({
    skip: !user?.id,
  });
  const [updateSettings] = useUpdateUserPreferencesMutation();

  const settings = data?.userSettings;

  const getAppSettings = useCallback((): AppSettings => {
    return {
      theme: settings?.theme || AppTheme.System,
      compactMode: settings?.compactMode ?? false,
      showTutorials: settings?.showTutorials ?? true,
      autoSync: settings?.autoSync ?? true,
      offlineMode: settings?.offlineMode ?? false,
      shareUsageData: settings?.shareUsageData ?? true,
      shareWithPartners: settings?.shareWithPartners ?? false,
      personalizedAds: settings?.personalizedAds ?? false,
      preferredUnitSystem: settings?.preferredUnitSystem || UnitSystem.Metric,
      enabledFeatures: settings?.enabledFeatures || [],
      betaFeatures: settings?.betaFeatures || [],
    };
  }, [settings]);

  const updateAppSetting = useCallback(
    async (key: keyof AppSettings, value: any) => {
      try {
        await updateSettings({
          variables: {
            input: {[key]: value},
          },
        });

        await refetch();
        return true;
      } catch (error) {
        console.error('Failed to update app setting:', error);
        return false;
      }
    },
    [updateSettings, refetch],
  );

  const updateMultipleSettings = useCallback(
    async (updates: Partial<AppSettings>) => {
      try {
        await updateSettings({
          variables: {
            input: updates,
          },
        });

        await refetch();
        return true;
      } catch (error) {
        console.error('Failed to update app settings:', error);
        return false;
      }
    },
    [updateSettings, refetch],
  );

  const resetToDefaults = useCallback(async () => {
    const defaultSettings: Partial<AppSettings> = {
      theme: AppTheme.System,
      compactMode: false,
      showTutorials: true,
      autoSync: true,
      offlineMode: false,
      shareUsageData: true,
      shareWithPartners: false,
      personalizedAds: false,
      preferredUnitSystem: UnitSystem.Metric,
    };

    return updateMultipleSettings(defaultSettings);
  }, [updateMultipleSettings]);

  return {
    settings: getAppSettings(),
    loading,
    updateAppSetting,
    updateMultipleSettings,
    resetToDefaults,
    refetch,
  };
};
