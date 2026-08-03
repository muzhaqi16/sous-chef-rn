import { useEffect } from 'react';
import { useUser } from '#store/useAppStore';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  GetNotificationPreferencesDocument,
  UpdateNotificationPreferencesDocument,
  type UpdateNotificationPreferencesMutation,
} from '#operations/user/user.generated';
import {
  ExpirationFrequency,
  type UpdateNotificationPreferencesInput,
} from '#/graphql/generated/schemaTypes';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { handleMutationError } from '#/utils/errorHandlers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { computeIsQuietTime } from '#/utils/notifications/quietHours';
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
 * Inverse of toNestedInput — collapses the input groups back to flat setting
 * keys. The optimistic response patches the flat NotificationPreferences
 * entity, so it needs the changed keys at the top level; spreading the nested
 * input directly would add `channels` / `features` keys that the mutation's
 * selection set ignores, leaving every real field at its pre-mutation value.
 */
function fromNestedInput(
  input: UpdateNotificationPreferencesInput,
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const group of [
    input.channels,
    input.expiration,
    input.features,
    input.quietHours,
  ]) {
    if (group) Object.assign(flat, group);
  }
  return flat;
}

/**
 * A refused update still resolves with HTTP 200: the result union carries a
 * `ValidationError` / `ForbiddenError` / `NotFoundError` / `ConflictError`
 * member instead of the payload, so `data` is truthy and the mutation's
 * `onError` never fires. Only the payload member means the change was
 * persisted — anything else must report failure, or the toggle silently snaps
 * back with the caller believing it succeeded.
 */
function didPersist(
  result: { data?: unknown; error?: unknown } | false | null,
): boolean {
  if (!result) return false;

  const outcome = classifyCreateResult(
    result,
    'updateNotificationPreferences',
    'UpdateNotificationPreferencesPayload',
  );
  if (outcome !== 'rejected') return true;

  // Transport errors are already reported through the mutation's onError; this
  // logs the server's reason for the union-error case, which has none.
  if (!result.error) {
    const data = result.data as
      | { updateNotificationPreferences?: unknown }
      | null
      | undefined;
    logger.warn(
      'UpdateNotificationPreferences rejected:',
      data?.updateNotificationPreferences,
    );
  }
  return false;
}

export const useNotificationSettings = (options?: { skip?: boolean }) => {
  const user = useUser();

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
      // No manual cache update needed (Pattern 2)
      optimisticResponse: (variables, { IGNORE }) => {
        if (!preferences) return IGNORE;

        // Filter out null/undefined values from input to prevent overriding non-nullable fields
        const definedInputs = Object.fromEntries(
          Object.entries(fromNestedInput(variables.input)).filter(
            ([, v]) => v != null,
          ),
        );

        const optimistic: UpdateNotificationPreferencesMutation = {
          __typename: 'Mutation',
          updateNotificationPreferences: {
            __typename: 'UpdateNotificationPreferencesPayload',
            notificationPreferences: {
              ...preferences,
              ...definedInputs,
              __typename: 'NotificationPreferences',
            },
          },
        };
        return optimistic;
      },
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

  const updateNotificationSetting = async (
    key: keyof NotificationSettings,
    value: boolean | string | number | ExpirationFrequency,
  ) => {
    const result = await executeMutation(
      () =>
        updatePreferences({
          variables: { input: toNestedInput({ [key]: value }) },
        }),
      'Failed to update notification setting',
    );
    return didPersist(result);
  };

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

    const result = await executeMutation(
      () =>
        updatePreferences({
          variables: { input: toNestedInput(cleanedUpdates) },
        }),
      'Failed to update notification settings',
    );
    return didPersist(result);
  };

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
    updateNotificationSetting,
    updateMultipleSettings,
    resetToDefaults,
    isQuietTime,
  };
};
