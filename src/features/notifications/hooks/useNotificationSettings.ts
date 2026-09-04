import { useEffect } from 'react';
import { useUser } from '#store/useAppStore';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import {
  GetNotificationPreferencesDocument,
  UpdateNotificationPreferencesDocument,
} from '#operations/user/user.generated';
import {
  ExpirationFrequency,
  type UpdateNotificationPreferencesInput,
} from '#/graphql/generated/schemaTypes';
import type { ApolloCache } from '@apollo/client';
import { handleMutationError } from '#/utils/errorHandlers';
import {
  snapshotFields,
  type FieldsEntityRef,
  updateEntityFieldsLocalFirst,
} from '#/apollo/utils/localFirstFields';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { computeIsQuietTime } from '#features/notifications/utils/quietHours';
import { logger } from '#/utils/environment';

export interface NotificationSettings {
  // Core toggles
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;

  // Pantry notifications
  expirationNotifications: boolean;
  expirationNotificationFrequency: ExpirationFrequency;
  expirationDaysThreshold: number;
  lowStockAlerts: boolean;
  pantryChanges: boolean;

  // Shopping list and collaboration
  shoppingListUpdates: boolean;
  collaborationInvites: boolean;
  homeInvites: boolean;
  sharedListUpdates: boolean;

  // Recipe and meal planning
  recipeRecommendations: boolean;
  mealPlanReminders: boolean;
  cookingReminders: boolean;

  // Digests and reports
  weeklyDigest: boolean;
  monthlyReport: boolean;

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: string | null;
}

const CHANNELS_KEYS = new Set(['emailEnabled', 'pushEnabled', 'smsEnabled']);

const EXPIRATION_KEYS = new Set([
  'expirationNotifications',
  'expirationNotificationFrequency',
  'expirationDaysThreshold',
]);

const QUIET_HOURS_KEYS = new Set([
  'quietHoursEnabled',
  'quietHoursStart',
  'quietHoursEnd',
  'quietHoursTimezone',
]);

/**
 * Maps flat notification setting keys to the nested UpdateNotificationPreferencesInput structure.
 * Keys not matching channels, expiration, or quietHours are placed under features.
 */
function toNestedInput(
  flat: Record<string, unknown>,
): UpdateNotificationPreferencesInput {
  const input: UpdateNotificationPreferencesInput = {};
  const channels: Record<string, unknown> = {};
  const expiration: Record<string, unknown> = {};
  const features: Record<string, unknown> = {};
  const quietHours: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flat)) {
    if (CHANNELS_KEYS.has(key)) {
      channels[key] = value;
    } else if (EXPIRATION_KEYS.has(key)) {
      expiration[key] = value;
    } else if (QUIET_HOURS_KEYS.has(key)) {
      quietHours[key] = value;
    } else {
      features[key] = value;
    }
  }

  if (Object.keys(channels).length > 0) input.channels = channels;
  if (Object.keys(expiration).length > 0) input.expiration = expiration;
  if (Object.keys(features).length > 0) input.features = features;
  if (Object.keys(quietHours).length > 0) input.quietHours = quietHours;

  return input;
}

/**
 * A refusal resolves with a union-error member instead of the payload, so
 * `data` is truthy and `onError` never fires. This logs the server's reason for
 * that case; classification lives in `updateEntityFieldsLocalFirst`.
 */
function reportRefusal(
  result: { data?: unknown; error?: unknown } | undefined | null,
): void {
  if (!result || result.error) return;

  const data = result.data as
    | { updateNotificationPreferences?: unknown }
    | null
    | undefined;
  logger.warn(
    'UpdateNotificationPreferences rejected:',
    data?.updateNotificationPreferences,
  );
}

/**
 * The shared write path: cache first, fire with `localFirst`, revert only on a
 * genuine refusal. Module scope so the quiet-hours timezone effect can reuse it
 * without a per-render dependency that would re-arm it every render. Returns
 * whether the change is safe to treat as saved (queued counts).
 */
export async function applySettingsUpdate({
  cache,
  entity,
  updates,
  previous,
  mutate,
}: {
  cache: ApolloCache;
  entity: FieldsEntityRef | undefined;
  updates: Partial<NotificationSettings>;
  previous: Partial<NotificationSettings>;
  mutate: (
    input: UpdateNotificationPreferencesInput,
  ) => Promise<{ data?: unknown; error?: unknown }>;
}): Promise<boolean> {
  // Convert null to undefined for GraphQL input
  const cleanedUpdates = Object.fromEntries(
    Object.entries(updates).map(([key, value]) => [
      key,
      value === null ? undefined : value,
    ]),
  );

  const { persisted, result } =
    await updateEntityFieldsLocalFirst<NotificationSettings>({
      cache,
      entity,
      updates,
      previous,
      // localFirst: an unreachable API queues the change for replay rather
      // than failing it, so the toggle the user just flipped isn't lost.
      mutate: () => mutate(toNestedInput(cleanedUpdates)),
      logLabel: 'Failed to update notification settings',
    });

  // Queued counts as persisted — it replays later. `reportRefusal` logs the
  // server's reason for the union-error case; the screen shows the alert.
  if (!persisted) {
    reportRefusal(result);
    return false;
  }
  return true;
}

export const useNotificationSettings = (options?: { skip?: boolean }) => {
  const user = useUser();
  const client = useApolloClient();

  // cache-and-network (the app-wide default) paints from cache and still
  // refreshes on mount. Under cache-first this query never reached the network
  // once anything was cached, so a cache that lacked `me.notificationPreferences`
  // could never repair itself and `settings` stayed on the defaults below —
  // which reads as "every toggle is broken".
  const skipped = !user?.id || !!options?.skip;
  const { data, loading, error, refetch } = useQuery(
    GetNotificationPreferencesDocument,
    {
      skip: skipped,
      fetchPolicy: 'cache-and-network',
    },
  );

  const preferences = data?.me?.notificationPreferences;

  useApolloErrorLogger('GetNotificationPreferences', error);

  // Without preferences every value below is a fabricated default that the
  // settings screen presents as if it were saved state, and no write can ever
  // change it. Say so rather than letting the screen quietly lie.
  useEffect(() => {
    if (!loading && !preferences) {
      logger.warn(
        'Notification preferences unavailable — settings screen is showing defaults.',
        { skipped, hasUser: !!user?.id, hasError: !!error },
      );
    }
  }, [loading, preferences, skipped, user?.id, error]);

  const [updatePreferences] = useMutation(
    UpdateNotificationPreferencesDocument,
    {
      // The mutation returns the full fragment, so normalization is the whole
      // cache update. No `optimisticResponse`: callers write permanently before
      // firing, and an optimistic layer is torn down on completion — offline
      // that completion is `queueLink`'s null result, which snaps every toggle
      // back while the change sits queued.
      onError: error => {
        // Telemetry only — every caller already surfaces one alert off the
        // returned boolean, so alerting here too would double up.
        handleMutationError(error, {
          operation: 'Update Notification Preferences',
          showAlert: false,
        });
      },
    },
  );

  // PERFORMANCE: Memoize settings object to prevent recreating on every render
  const settings = (() => {
    return {
      // Core toggles
      emailEnabled: preferences?.emailEnabled ?? true,
      pushEnabled: preferences?.pushEnabled ?? false,
      smsEnabled: preferences?.smsEnabled ?? false,

      // Pantry notifications
      expirationNotifications: preferences?.expirationNotifications ?? true,
      expirationNotificationFrequency:
        preferences?.expirationNotificationFrequency ??
        ExpirationFrequency.DailyMorning,
      expirationDaysThreshold: preferences?.expirationDaysThreshold ?? 3,
      lowStockAlerts: preferences?.lowStockAlerts ?? true,
      pantryChanges: preferences?.pantryChanges ?? true,

      // Shopping list and collaboration
      shoppingListUpdates: preferences?.shoppingListUpdates ?? true,
      collaborationInvites: preferences?.collaborationInvites ?? true,
      homeInvites: preferences?.homeInvites ?? true,
      sharedListUpdates: preferences?.sharedListUpdates ?? true,

      // Recipe and meal planning
      recipeRecommendations: preferences?.recipeRecommendations ?? true,
      mealPlanReminders: preferences?.mealPlanReminders ?? true,
      cookingReminders: preferences?.cookingReminders ?? true,

      // Digests and reports
      weeklyDigest: preferences?.weeklyDigest ?? false,
      monthlyReport: preferences?.monthlyReport ?? false,

      // Quiet hours
      quietHoursEnabled: preferences?.quietHoursEnabled ?? false,
      quietHoursStart: preferences?.quietHoursStart ?? '22:00',
      quietHoursEnd: preferences?.quietHoursEnd ?? '08:00',
      quietHoursTimezone: preferences?.quietHoursTimezone ?? null,
    };
  })();

  /** The cached entity carrying the settings fields, once the query has loaded. */
  const preferencesEntity = preferences?.id
    ? { __typename: 'NotificationPreferences', id: preferences.id }
    : undefined;

  const updateMultipleSettings = async (
    updates: Partial<NotificationSettings>,
  ) => {
    const previous = snapshotFields<NotificationSettings>(settings, updates);

    return applySettingsUpdate({
      cache: client.cache,
      entity: preferencesEntity,
      updates,
      previous,
      mutate: input =>
        updatePreferences({
          variables: { input },
          context: { localFirst: true },
        }),
    });
  };

  /** Single-key convenience over {@link updateMultipleSettings}. */
  const updateNotificationSetting = async (
    key: keyof NotificationSettings,
    value: boolean | string | number | ExpirationFrequency,
  ) =>
    updateMultipleSettings({
      [key]: value,
    } as Partial<NotificationSettings>);

  const resetToDefaults = async () => {
    const defaultSettings: Partial<NotificationSettings> = {
      emailEnabled: true,
      pushEnabled: false,
      smsEnabled: false,
      expirationNotifications: true,
      expirationNotificationFrequency: ExpirationFrequency.DailyMorning,
      expirationDaysThreshold: 3,
      lowStockAlerts: true,
      pantryChanges: true,
      shoppingListUpdates: true,
      collaborationInvites: true,
      homeInvites: true,
      sharedListUpdates: true,
      recipeRecommendations: true,
      mealPlanReminders: true,
      cookingReminders: true,
      weeklyDigest: false,
      monthlyReport: false,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    };

    return updateMultipleSettings(defaultSettings);
  };

  // Evaluated in the user's configured IANA timezone (not the device's) so
  // client suppression matches the server's. See computeIsQuietTime.
  const isQuietTime = (): boolean => computeIsQuietTime(settings);

  return {
    settings,
    loading,
    // `settings` always has a value — every field below falls back to a
    // fabricated default — so it cannot tell a screen whether the server has
    // answered. A screen gating on `loading` alone blanks itself on every
    // mount: `cache-and-network` reports `loading: true` for the whole network
    // leg even when the cache already answered, and `nextFetchPolicy` does not
    // survive an unmount (useQuery builds a new ObservableQuery per mount).
    hasPreferences: !!preferences,
    skipped,
    error,
    refetch,
    updateNotificationSetting,
    updateMultipleSettings,
    resetToDefaults,
    isQuietTime,
  };
};
