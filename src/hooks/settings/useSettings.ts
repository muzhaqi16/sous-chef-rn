import { useCallback, useMemo, useState } from 'react';
import { useAppStore } from '#/store/useAppStore';
import { useAppSettings } from '#hooks/profile/useAppSettings';
import { storage } from '#/storage/mmkv';

/**
 * Unified settings interface combining local (Zustand) and server (GraphQL) settings
 */
export interface UnifiedSettings {
  // Server settings
  showTutorials: boolean;
  autoSync: boolean;
  offlineMode: boolean;

  // Local settings (Zustand)
  hapticFeedbackEnabled: boolean;
  showNavigationLabels: boolean;
}

/**
 * Settings actions for updating values
 */
export interface SettingsActions {
  // Server settings updates
  setShowTutorials: (enabled: boolean) => Promise<boolean>;
  setAutoSync: (enabled: boolean) => Promise<boolean>;
  setOfflineMode: (enabled: boolean) => Promise<boolean>;

  // Local settings updates
  setHapticFeedbackEnabled: (enabled: boolean) => void;
  setShowNavigationLabels: (enabled: boolean) => void;

  // Bulk actions
  resetToDefaults: () => Promise<boolean>;
}

/**
 * Centralized settings hook combining local and server settings
 *
 * This is the single source of truth for all app settings, combining:
 * - Server settings (GraphQL via useAppSettings)
 * - Local preferences (Zustand store)
 *
 * @example
 * ```tsx
 * const { settings, actions, loading } = useSettings();
 *
 * // Read settings
 * if (settings.showTutorials) { ... }
 *
 * // Update settings
 * actions.setShowNavigationLabels(false);
 * await actions.setOfflineMode(true);
 * ```
 */
export const useSettings = () => {
  // Server settings
  const {
    settings: serverSettings,
    loading: serverLoading,
    updateAppSetting,
    resetToDefaults: resetServerDefaults,
  } = useAppSettings();

  // Local settings from Zustand
  const hapticFeedbackEnabled = useAppStore(state => state.hapticFeedbackEnabled);
  const setHapticFeedbackEnabled = useAppStore(state => state.setHapticFeedbackEnabled);
  const showNavigationLabels = useAppStore(state => state.showNavigationLabels);
  const setShowNavigationLabels = useAppStore(state => state.setShowNavigationLabels);
  const resetPreferences = useAppStore(state => state.resetPreferences);

  // Unified settings object
  const settings = useMemo<UnifiedSettings>(() => ({
    // Server settings
    showTutorials: serverSettings.showTutorials,
    autoSync: serverSettings.autoSync,
    offlineMode: serverSettings.offlineMode,

    // Local settings
    hapticFeedbackEnabled,
    showNavigationLabels,
  }), [
    serverSettings.showTutorials,
    serverSettings.autoSync,
    serverSettings.offlineMode,
    hapticFeedbackEnabled,
    showNavigationLabels,
  ]);

  // Settings actions
  const setShowTutorials = useCallback(
    (enabled: boolean) => updateAppSetting('showTutorials', enabled),
    [updateAppSetting]
  );

  const setAutoSync = useCallback(
    (enabled: boolean) => updateAppSetting('autoSync', enabled),
    [updateAppSetting]
  );

  const setOfflineMode = useCallback(
    (enabled: boolean) => updateAppSetting('offlineMode', enabled),
    [updateAppSetting]
  );

  const resetToDefaults = useCallback(async () => {
    // Reset both server and local settings
    const serverSuccess = await resetServerDefaults();
    resetPreferences();
    return serverSuccess;
  }, [resetServerDefaults, resetPreferences]);

  const actions = useMemo<SettingsActions>(() => ({
    setShowTutorials,
    setAutoSync,
    setOfflineMode,
    setHapticFeedbackEnabled,
    setShowNavigationLabels,
    resetToDefaults,
  }), [
    setShowTutorials,
    setAutoSync,
    setOfflineMode,
    setHapticFeedbackEnabled,
    setShowNavigationLabels,
    resetToDefaults,
  ]);

  return {
    settings,
    actions,
    loading: serverLoading,
  };
};

/**
 * Selector hook for just the showTutorials setting
 * Use this when you only need to check if tutorials are enabled
 *
 * PERFORMANCE: Reads from MMKV instead of triggering the GetUserSettings GraphQL query.
 * The MMKV value is synced whenever useAppSettings loads fresh data (see useAppSettings).
 */
export const useShowTutorials = (): boolean => {
  const [value] = useState(() => storage.getBoolean('user_show_tutorials') ?? true);
  return value;
};

/**
 * Selector hook for just the showNavigationLabels setting
 * Use this when you only need to check if navigation labels are enabled
 */
export const useShowNavigationLabels = (): boolean => {
  return useAppStore(state => state.showNavigationLabels);
};
