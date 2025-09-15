import {useCallback} from 'react';
import {useStore} from '#store';
import {
  useUpdateUserPreferencesMutation,
  useGetUserSettingsQuery,
} from '#generated';

export interface NotificationSettings {
  // General settings
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  
  // Pantry notifications
  expiredItemAlerts: boolean;
  lowStockAlerts: boolean;
  pantryUpdates: boolean;
  
  // Shopping list notifications
  shoppingListUpdates: boolean;
  collaboratorChanges: boolean;
  itemCompletedNotifications: boolean;
  
  // Home and membership notifications
  homeInvitations: boolean;
  membershipChanges: boolean;
  newMemberNotifications: boolean;
  
  // Other settings
  weeklyDigest: boolean;
  recipeRecommendations: boolean;
  urgentNotificationsOnly: boolean;
  quietHours: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export const useNotificationSettings = () => {
  const user = useStore(state => state.user);
  const {data, loading, refetch} = useGetUserSettingsQuery({
    skip: !user?.id,
  });
  const [updateSettings] = useUpdateUserPreferencesMutation();

  const settings = data?.userSettings;

  const getNotificationSettings = useCallback((): NotificationSettings => {
    return {
      // General settings - use existing fields
      pushNotifications: settings?.pushNotifications ?? true,
      emailNotifications: settings?.emailNotifications ?? true,
      smsNotifications: settings?.smsNotifications ?? false,
      
      // Pantry notifications - use existing fields where available
      expiredItemAlerts: settings?.expiredItemAlerts ?? true,
      lowStockAlerts: settings?.lowStockAlerts ?? true,
      pantryUpdates: settings?.pushNotifications ?? true, // Use pushNotifications as fallback
      
      // Shopping list notifications - use existing fields where available
      shoppingListUpdates: settings?.shoppingListUpdates ?? true,
      collaboratorChanges: settings?.pushNotifications ?? true, // Use pushNotifications as fallback
      itemCompletedNotifications: settings?.pushNotifications ?? true, // Use pushNotifications as fallback
      
      // Home and membership notifications - use pushNotifications as fallback
      homeInvitations: settings?.pushNotifications ?? true,
      membershipChanges: settings?.pushNotifications ?? true,
      newMemberNotifications: settings?.pushNotifications ?? true,
      
      // Other settings - use existing fields where available
      weeklyDigest: settings?.weeklyDigest ?? false,
      recipeRecommendations: settings?.recipeRecommendations ?? false,
      urgentNotificationsOnly: false, // Default to false for now
      quietHours: false, // Default to false for now
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    };
  }, [settings]);

  const updateNotificationSetting = useCallback(
    async (key: keyof NotificationSettings, value: boolean | string) => {
      try {
        await updateSettings({
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
    [updateSettings, refetch],
  );

  const updateMultipleSettings = useCallback(
    async (updates: Partial<NotificationSettings>) => {
      try {
        await updateSettings({
          variables: {
            input: updates,
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
    [updateSettings, refetch],
  );

  const resetToDefaults = useCallback(async () => {
    const defaultSettings: NotificationSettings = {
      pushNotifications: true,
      emailNotifications: true,
      smsNotifications: false,
      expiredItemAlerts: true,
      lowStockAlerts: true,
      pantryUpdates: true,
      shoppingListUpdates: true,
      collaboratorChanges: true,
      itemCompletedNotifications: true,
      homeInvitations: true,
      membershipChanges: true,
      newMemberNotifications: true,
      weeklyDigest: false,
      recipeRecommendations: false,
      urgentNotificationsOnly: false,
      quietHours: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    };

    return updateMultipleSettings(defaultSettings);
  }, [updateMultipleSettings]);

  const isQuietTime = useCallback((): boolean => {
    const currentSettings = getNotificationSettings();
    
    if (!currentSettings.quietHours) {
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

  const shouldShowNotification = useCallback(
    (type: 'pantry' | 'shopping' | 'membership' | 'system', priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'): boolean => {
      const currentSettings = getNotificationSettings();
      
      // Always show urgent notifications unless explicitly disabled
      if (priority === 'urgent' && !currentSettings.urgentNotificationsOnly) {
        return true;
      }
      
      // If in urgent-only mode, only show urgent notifications
      if (currentSettings.urgentNotificationsOnly && priority !== 'urgent') {
        return false;
      }
      
      // Respect quiet hours for non-urgent notifications
      if (priority !== 'urgent' && isQuietTime()) {
        return false;
      }
      
      // Check type-specific settings
      switch (type) {
        case 'pantry':
          return currentSettings.pantryUpdates;
        case 'shopping':
          return currentSettings.shoppingListUpdates;
        case 'membership':
          return currentSettings.membershipChanges;
        case 'system':
        default:
          return currentSettings.pushNotifications;
      }
    },
    [getNotificationSettings, isQuietTime],
  );

  return {
    settings: getNotificationSettings(),
    loading,
    updateNotificationSetting,
    updateMultipleSettings,
    resetToDefaults,
    isQuietTime,
    shouldShowNotification,
    refetch,
  };
};