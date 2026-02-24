import { useCallback, useMemo, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAppStore } from '#store/useAppStore';
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  ExpirationFrequency,
  type UpdateNotificationPreferencesInput,
} from '#generated';
import { useErrorService } from '#/services/errorService';

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

const CHANNELS_KEYS = new Set([
  'emailEnabled',
  'pushEnabled',
  'smsEnabled',
]);

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

export const useNotificationSettings = () => {
  const user = useAppStore(state => state.user);
  const { handleApolloError } = useErrorService();

  // PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
  // - cache-first: Uses cache if available for settings
  // - errorPolicy: 'all' returns cached data when network fails

  const { data, loading, error } = useGetNotificationPreferencesQuery({
    skip: !user?.id,
    fetchPolicy: 'cache-first',
    errorPolicy: 'all',
  });

  const preferences = data?.me?.notificationPreferences;

  // Log partial errors in development
  useEffect(() => {
    if (__DEV__ && error) {
      console.warn('⚠️ Partial error loading notification preferences:', error);
    }
  }, [error]);

  // Update notification preferences mutation
  const [updatePreferences] = useUpdateNotificationPreferencesMutation({
    errorPolicy: 'all',
    // Uses automatic normalization - mutation returns full NotificationPreferences fragment
    // No manual cache update needed (Pattern 2)
    optimisticResponse: (variables, { IGNORE }) => {
      if (!preferences) return IGNORE;

      // Filter out null/undefined values from input to prevent overriding non-nullable fields
      const definedInputs = Object.fromEntries(
        Object.entries(variables.input).filter(([, v]) => v != null),
      );

      return {
        __typename: 'Mutation',
        updateNotificationPreferences: {
          __typename: 'NotificationPreferencesPayload',
          success: true,
          message: 'Notification preferences updated',
          code: 'NOTIFICATION_PREFERENCES_UPDATED',
          notificationPreferences: {
            ...preferences,
            ...definedInputs,
            __typename: 'NotificationPreferences',
            updatedAt: new Date().toISOString(),
          },
        },
      };
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Notification Preferences',
      });
      Alert.alert('Error', message);
    },
  });

  // PERFORMANCE: Memoize settings object to prevent recreating on every render
  const settings = useMemo((): NotificationSettings => {
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
  }, [preferences]);

  const updateNotificationSetting = useCallback(
    async (
      key: keyof NotificationSettings,
      value: boolean | string | number | ExpirationFrequency,
    ) => {
      try {
        const result = await updatePreferences({
          variables: {
            input: toNestedInput({ [key]: value }),
          },
        });

        // No refetch needed - automatic normalization + optimistic response handle UI updates
        return !!result.data;
      } catch {
        // Error handled by onError handler
        return false;
      }
    },
    [updatePreferences],
  );

  const updateMultipleSettings = useCallback(
    async (updates: Partial<NotificationSettings>) => {
      try {
        // Convert null to undefined for GraphQL input
        const cleanedUpdates = Object.fromEntries(
          Object.entries(updates).map(([key, value]) => [
            key,
            value === null ? undefined : value,
          ]),
        );

        const result = await updatePreferences({
          variables: {
            input: toNestedInput(cleanedUpdates),
          },
        });

        // No refetch needed - automatic normalization + optimistic response handle UI updates
        return !!result.data;
      } catch {
        // Error handled by onError handler
        return false;
      }
    },
    [updatePreferences],
  );

  const resetToDefaults = useCallback(async () => {
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
  }, [updateMultipleSettings]);

  // PERFORMANCE: Use memoized settings instead of calling function
  const isQuietTime = useCallback((): boolean => {
    if (
      !settings.quietHoursEnabled ||
      !settings.quietHoursStart ||
      !settings.quietHoursEnd
    ) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = settings.quietHoursStart
      .split(':')
      .map(Number);
    const [endHour, endMin] = settings.quietHoursEnd.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle quiet hours that cross midnight
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }, [settings]);

  return {
    settings,
    loading,
    updateNotificationSetting,
    updateMultipleSettings,
    resetToDefaults,
    isQuietTime,
  };
};
