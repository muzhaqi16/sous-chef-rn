import { useEffect } from 'react';
import { useUser } from '#store/useAppStore';
import { useStore } from '#store';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import {
  GetUserSettingsDocument,
  UpdateUserPreferencesDocument,
} from '#operations/auth/user.generated';
import {
  AppTheme,
  UnitSystem,
  type UpdateSettingsInput,
} from '#/graphql/generated/schemaTypes';
import { updateEntityFieldsLocalFirst } from '#/apollo/utils/localFirstFields';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n/t';
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
  const client = useApolloClient();
  const { data, loading, error, refetch } = useQuery(GetUserSettingsDocument, {
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

  // Resolved once per render — also the snapshot the mutators revert to when the
  // server rejects an optimistic change.
  const memoizedSettings = getAppSettings();

  const toSettingsInput = (
    updates: Partial<AppSettings>,
  ): UpdateSettingsInput => {
    const input: UpdateSettingsInput = {};
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

  /** The cached entity carrying the settings fields, once the query has loaded. */
  const settingsEntity = settings?.id
    ? { __typename: 'UserSettings', id: settings.id }
    : undefined;

  const updateMultipleSettings = async (
    updates: Partial<AppSettings>,
    failureMessage: string = t('settings.updateFailed'),
  ) => {
    const keys = Object.keys(updates) as (keyof AppSettings)[];
    const previous: Partial<AppSettings> = Object.fromEntries(
      keys.map(key => [key, memoizedSettings[key]]),
    );

    const { persisted, result } =
      await updateEntityFieldsLocalFirst<AppSettings>({
        cache: client.cache,
        entity: settingsEntity,
        updates,
        previous,
        // localFirst: an unreachable API queues the change for replay instead of
        // failing it, so the setting the user just flipped isn't lost.
        mutate: () =>
          updateSettings({
            variables: { input: toSettingsInput(updates) },
            context: { localFirst: true },
          }),
        logLabel: 'Update Settings',
      });

    // `alertIfRejected` is the ONLY alerter for this call (there is no mutation
    // `onError`) — callers must not add their own, see its contract. It no-ops
    // on the throw case, which `executeMutation` already reported.
    if (!persisted) {
      alertIfRejected(result, failureMessage);
      return false;
    }
    return true;
  };

  /** Single-key convenience over {@link updateMultipleSettings}. */
  const updateAppSetting = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => updateMultipleSettings({ [key]: value } as Partial<AppSettings>);

  const resetToDefaults = async () => {
    const defaultSettings: Partial<AppSettings> = {
      theme: AppTheme.System,
      compactMode: false,
      showTutorials: true,
      autoSync: true,
      offlineMode: false,
      preferredUnitSystem: UnitSystem.Metric,
    };

    return updateMultipleSettings(defaultSettings, t('settings.resetFailed'));
  };

  // PERFORMANCE: Sync settings to MMKV so startup-path hooks can read them
  // without triggering the GetUserSettings GraphQL query at startup.
  // - useShowTutorials reads 'user_show_tutorials' from MMKV
  // - offlineModeEnabled is mirrored to MMKV by networkSlice.setOfflineModeEnabled
  useEffect(() => {
    if (
      settings?.showTutorials !== undefined &&
      storage.getBoolean('user_show_tutorials') !== settings.showTutorials
    ) {
      storage.set('user_show_tutorials', settings.showTutorials);
      // Already-mounted tutorial hooks snapshot this MMKV value at mount and
      // only re-read on the reset signal — bump it so a server-driven change
      // (e.g. the account turned tutorials off on another device) reaches them.
      useStore.getState().bumpTutorialResetGeneration();
    }
    if (settings?.offlineMode !== undefined) {
      useStore.getState().setOfflineModeEnabled(settings.offlineMode);
    }
  }, [settings?.showTutorials, settings?.offlineMode]);

  return {
    settings: memoizedSettings,
    loading,
    // errorPolicy:'all' (global) resolves failures with data+error rather than
    // throwing — expose `error` so consumers can surface a load failure.
    error,
    updateAppSetting,
    updateMultipleSettings,
    resetToDefaults,
    refetch,
  };
};
