import { useEffect } from 'react';
import { useUser } from '#store/useAppStore';
import { useStore } from '#store';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import {
  GetUserSettingsDocument,
  UpdateUserPreferencesDocument,
} from '#operations/auth/user.generated';
import {
  AppTheme,
  UnitSystem,
  type UpdateSettingsInput,
} from '#/graphql/generated/schemaTypes';
import { executeMutation } from '#/utils/compilerSafeWrappers';
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

/**
 * Write one setting into the cached `UserSettings` entity.
 *
 * Settings are local-first: the switch has to flip the moment it's tapped, and
 * the change has to survive an unreachable API (the offline-mode switch in
 * particular — needing the server to turn OFFLINE mode on is the one case where
 * a round-trip is guaranteed to be unavailable). Writing the cache here is what
 * makes that true, since the screen renders from the `GetUserSettings` query and
 * `offlineModeEnabled` is mirrored into the store from the same value.
 *
 * Reverted by the caller when the server rejects the change.
 */
function writeSettingToCache<K extends keyof AppSettings>(
  cache: ApolloCache,
  settingsId: string,
  key: K,
  value: AppSettings[K],
): void {
  const cacheId = cache.identify({
    __typename: 'UserSettings',
    id: settingsId,
  });
  // Without the guard a missing id would fall through to ROOT_QUERY.
  if (!cacheId) return;
  // Widened to the value union before it reaches the modifier: Apollo types a
  // modifier's return as `DeepPartial<T>`, which TypeScript can't evaluate
  // while `T` is still the unresolved `AppSettings[K]`. Callers keep the
  // key/value correlation through the `K` parameter.
  const nextValue: AppSettings[keyof AppSettings] = value;
  // Every AppSettings key is a field of the same name on UserSettings.
  cache.modify({ id: cacheId, fields: { [key]: () => nextValue } });
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

  const updateAppSetting = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    const input = toSettingsInput({ [key]: value } as Partial<AppSettings>);
    const settingsId = settings?.id;
    const previous = memoizedSettings[key];
    if (settingsId) {
      writeSettingToCache(client.cache, settingsId, key, value);
    }

    const result = await executeMutation(
      // localFirst: an unreachable API queues the change for replay instead of
      // failing it, so the setting the user just flipped isn't lost.
      () =>
        updateSettings({
          variables: { input },
          context: { localFirst: true },
        }),
      'Update Setting',
    );

    // `alertIfRejected` is the ONLY alerter for this call (there is no mutation
    // `onError`) — callers must not add their own, see its contract.
    if (!result || alertIfRejected(result, t('settings.updateFailed'))) {
      if (settingsId) {
        writeSettingToCache(client.cache, settingsId, key, previous);
      }
      return false;
    }
    return true;
  };

  const updateMultipleSettings = async (
    updates: Partial<AppSettings>,
    failureMessage: string = t('settings.updateFailed'),
  ) => {
    const input = toSettingsInput(updates);
    const settingsId = settings?.id;
    const keys = Object.keys(updates) as (keyof AppSettings)[];
    // Annotated rather than inferred so each entry stays a two-element tuple —
    // a bare `.map` widens it to an array of the key/value union.
    const previous: Array<[keyof AppSettings, AppSettings[keyof AppSettings]]> =
      keys.map(key => [key, memoizedSettings[key]]);
    if (settingsId) {
      for (const key of keys) {
        const next = updates[key];
        if (next !== undefined) {
          writeSettingToCache(client.cache, settingsId, key, next);
        }
      }
    }

    const result = await executeMutation(
      () =>
        updateSettings({
          variables: { input },
          context: { localFirst: true },
        }),
      'Update Settings',
    );

    if (!result || alertIfRejected(result, failureMessage)) {
      if (settingsId) {
        for (const [key, value] of previous) {
          writeSettingToCache(client.cache, settingsId, key, value);
        }
      }
      return false;
    }
    return true;
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
