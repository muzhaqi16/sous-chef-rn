import React from 'react';
import {useRealTimeNotifications, useNotificationSettings} from '#hooks';
import {useStore} from '#store';

interface NotificationProviderProps {
  children: React.ReactNode;
}

/**
 * NotificationProvider - Wraps the app to enable real-time notifications
 * This component should be placed high in the component tree to ensure
 * notifications are active throughout the app lifecycle.
 */
export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const user = useStore(state => state.user);
  const isAuthenticated = useStore(state => state.isAuthenticated);
  
  // Get notification settings to configure the real-time system
  const {settings} = useNotificationSettings();

  // Initialize real-time notifications with user settings
  const {notificationCount, config} = useRealTimeNotifications({
    enablePantryNotifications: settings.pantryUpdates,
    enableShoppingListNotifications: settings.shoppingListUpdates,
    enableMembershipNotifications: settings.membershipChanges,
    enableLowStockAlerts: settings.lowStockAlerts,
    enableExpirationAlerts: settings.expiredItemAlerts,
    enableCollaborationNotifications: settings.collaboratorChanges,
    showInAppNotifications: settings.pushNotifications,
    showPushNotifications: settings.pushNotifications && !settings.urgentNotificationsOnly,
  });

  // Only initialize notifications if user is authenticated
  if (!isAuthenticated || !user) {
    return <>{children}</>;
  }

  return <>{children}</>;
};

export default NotificationProvider;