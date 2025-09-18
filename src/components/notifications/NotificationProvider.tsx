import React from 'react';
import {
  useNotifications,
  useNotificationSettings,
  useAuth,
} from '#hooks';

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
  const {user, isAuthenticated} = useAuth();

  // Get notification settings to configure the real-time system
  const {settings} = useNotificationSettings();

  // Initialize real-time notifications with user settings
  const {config} = useNotifications({
    enablePantryNotifications: settings.pantryUpdates,
    enableShoppingListNotifications: settings.shoppingListUpdates,
    enableMembershipNotifications: settings.membershipChanges,
    enableLowStockAlerts: settings.lowStockAlerts,
    enableExpirationAlerts: settings.expiredItemAlerts,
    enableCollaborationNotifications: settings.collaboratorChanges,
    showInAppNotifications: settings.pushNotifications,
    showPushNotifications:
      settings.pushNotifications && !settings.urgentNotificationsOnly,
  });

  // Only initialize notifications if user is authenticated
  if (!isAuthenticated || !user) {
    return <>{children}</>;
  }

  return <>{children}</>;
};

export default NotificationProvider;
