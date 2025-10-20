import {useCallback} from 'react';
import {useStore} from '#store';
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  ExpirationFrequency,
} from '#generated';

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

export const useNotificationSettings = () => {
  const user = useStore(state => state.user);
  const {data, loading, refetch} = useGetNotificationPreferencesQuery({
    skip: !user?.id,
  });
  const [updatePreferences] = useUpdateNotificationPreferencesMutation();

  const preferences = data?.myNotificationPreferences;

  const getNotificationSettings = useCallback((): NotificationSettings => {
    return {
      // Core toggles
      emailEnabled: preferences?.emailEnabled ?? true,
      pushEnabled: preferences?.pushEnabled ?? true,
      smsEnabled: preferences?.smsEnabled ?? false,

      // Pantry notifications
      expirationNotifications: preferences?.expirationNotifications ?? true,
      expirationNotificationFrequency: preferences?.expirationNotificationFrequency ?? ExpirationFrequency.DailyMorning,
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
    async (key: keyof NotificationSettings, value: boolean | string | number | ExpirationFrequency) => {
      try {
        await updatePreferences({
          variables: {
            input: {[key]: value},
          },
        });

        // Refetch to ensure local state is updated
        await refetch();

        return true;
      } catch (error) {
        console.error('Failed to update notification setting:', error);
        return false;
      }
    },
    [updatePreferences, refetch],
  );

  const updateMultipleSettings = useCallback(
    async (updates: Partial<NotificationSettings>) => {
      try {
        // Convert null to undefined for GraphQL input
        const cleanedUpdates = Object.fromEntries(
          Object.entries(updates).map(([key, value]) => [
            key,
            value === null ? undefined : value,
          ])
        );

        await updatePreferences({
          variables: {
            input: cleanedUpdates,
          },
        });

        // Refetch to ensure local state is updated
        await refetch();

        return true;
      } catch (error) {
        console.error('Failed to update notification settings:', error);
        return false;
      }
    },
    [updatePreferences, refetch],
  );

  const resetToDefaults = useCallback(async () => {
    const defaultSettings: Partial<NotificationSettings> = {
      emailEnabled: true,
      pushEnabled: true,
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

  const isQuietTime = useCallback((): boolean => {
    const currentSettings = getNotificationSettings();

    if (!currentSettings.quietHoursEnabled || !currentSettings.quietHoursStart || !currentSettings.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = currentSettings.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = currentSettings.quietHoursEnd.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle quiet hours that cross midnight
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }, [getNotificationSettings]);

  return {
    settings: getNotificationSettings(),
    loading,
    updateNotificationSetting,
    updateMultipleSettings,
    resetToDefaults,
    isQuietTime,
    refetch,
  };
};
