import { useEffect, useRef } from 'react';
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
import { handleMutationError } from '#/utils/errorHandlers';
import { updateEntityFieldsLocalFirst } from '#/apollo/utils/localFirstFields';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import {
  computeIsQuietTime,
  getDeviceTimezone,
} from '#/utils/notifications/quietHours';
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
 * A refused update still resolves with HTTP 200: the result union carries a
 * `ValidationError` / `ForbiddenError` / `NotFoundError` / `ConflictError`
 * member instead of the payload, so `data` is truthy and the mutation's
 * `onError` never fires. Transport errors are already reported through that
 * `onError`; this logs the server's reason for the union-error case, which
 * has none. Classification itself lives in `updateEntityFieldsLocalFirst`.
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

export const useNotificationSettings = (options?: { skip?: boolean }) => {
  const user = useUser();
  const client = useApolloClient();

  // cache-and-network (the app-wide default) paints from cache and still
  // refreshes on mount. Under cache-first this query never reached the network
  // once anything was cached, so a cache that lacked `me.notificationPreferences`
  // could never repair itself and `settings` stayed on the defaults below —
  // which reads as "every toggle is broken".
  const skipped = !user?.id || !!options?.skip;
  const { data, loading, error } = useQuery(
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

  // Update notification preferences mutation
  const [updatePreferences] = useMutation(
    UpdateNotificationPreferencesDocument,
    {
      // Uses automatic normalization - mutation returns full NotificationPreferences fragment
      // No manual cache update needed (Pattern 2).
      //
      // No `optimisticResponse`: the callers write the change into the cache
      // permanently before firing (see `updateEntityFieldsLocalFirst`). An optimistic
      // layer is rolled back as soon as the mutation completes, and offline that
      // completion is `queueLink`'s null result — which snapped every toggle
      // back to its old position while the change sat queued.
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
    // Convert null to undefined for GraphQL input
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).map(([key, value]) => [
        key,
        value === null ? undefined : value,
      ]),
    );

    const keys = Object.keys(updates) as (keyof NotificationSettings)[];
    const previous: Partial<NotificationSettings> = Object.fromEntries(
      keys.map(key => [key, settings[key]]),
    );

    const { persisted, result } =
      await updateEntityFieldsLocalFirst<NotificationSettings>({
        cache: client.cache,
        entity: preferencesEntity,
        updates,
        previous,
        // localFirst: an unreachable API queues the change for replay rather
        // than failing it, so the toggle the user just flipped isn't lost.
        mutate: () =>
          updatePreferences({
            variables: { input: toNestedInput(cleanedUpdates) },
            context: { localFirst: true },
          }),
        logLabel: 'Failed to update notification settings',
      });

    // Queued counts as persisted — it replays later. `reportRefusal` logs the
    // server's reason for the union-error case; the screen shows the alert.
    if (!persisted) {
      reportRefusal(result);
      return false;
    }
    return true;
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

  // Nothing else in the app writes quietHoursTimezone, so an account keeps the
  // API's "UTC" default and the window is applied on a UTC clock — 22:00–08:00
  // mutes 18:00–04:00 in New York, both here and in the server's suppression.
  // Point it at the device's zone so the configured window means the user's own
  // wall clock. Guarded by a ref: a rejected write must not re-fire every render.
  const syncedTimezone = useRef<string | null>(null);
  useEffect(() => {
    const deviceTimezone = getDeviceTimezone();
    if (
      !deviceTimezone ||
      !preferences?.quietHoursEnabled ||
      preferences.quietHoursTimezone === deviceTimezone ||
      syncedTimezone.current === deviceTimezone
    ) {
      return;
    }
    syncedTimezone.current = deviceTimezone;
    void updateNotificationSetting('quietHoursTimezone', deviceTimezone);
  }, [
    preferences?.quietHoursEnabled,
    preferences?.quietHoursTimezone,
    updateNotificationSetting,
  ]);

  // Evaluated in the user's configured IANA timezone (not the device's) so
  // client suppression matches the server's. See computeIsQuietTime.
  const isQuietTime = (): boolean => computeIsQuietTime(settings);

  return {
    settings,
    loading,
    updateNotificationSetting,
    updateMultipleSettings,
    resetToDefaults,
    isQuietTime,
  };
};
