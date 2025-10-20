import React from 'react';
import { useNotifications, useNotificationSettings, useAuth } from '#hooks';

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
  const { user, isAuthenticated } = useAuth();

  // Get notification settings to configure the real-time system
  const { settings } = useNotificationSettings();

  // Initialize real-time notifications with user settings
  useNotifications({
    enablePantryNotifications: settings.pantryChanges,
    enableShoppingListNotifications: settings.shoppingListUpdates,
    enableMembershipNotifications: settings.homeInvites,
    enableLowStockAlerts: settings.lowStockAlerts,
    enableExpirationAlerts: settings.expirationNotifications,
    enableCollaborationNotifications: settings.collaborationInvites,
    showInAppNotifications: settings.pushEnabled,
    showPushNotifications: settings.pushEnabled,
  });

  // Only initialize notifications if user is authenticated
  if (!isAuthenticated || !user) {
    return <>{children}</>;
  }

  return <>{children}</>;
};

export default NotificationProvider;
