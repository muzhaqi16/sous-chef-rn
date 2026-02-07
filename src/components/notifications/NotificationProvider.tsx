import React, { useState, useEffect } from 'react';
import { useNotifications } from '#hooks/notifications/useNotifications';
import { useNotificationSettings } from '#hooks/notifications/useNotificationSettings';
import { useAuth } from '#hooks/auth/useAuth';

interface NotificationProviderProps {
  children: React.ReactNode;
}

/**
 * NotificationListener - Handles all notification subscriptions as side effects.
 * Returns null to prevent rendering, ensuring re-renders don't cascade to app tree.
 *
 * PERFORMANCE: This pattern eliminates cascade re-renders. When NotificationListener
 * re-renders due to notification/auth state changes, it doesn't affect siblings
 * since it returns null (no React elements to reconcile).
 */
const NotificationListener: React.FC = () => {
  const {user, isAuthenticated} = useAuth();
  const {settings} = useNotificationSettings();

  // Defer subscription by 3s to avoid competing with startup queries on the JS thread
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (isAuthenticated && user) {
      const timer = setTimeout(() => setReady(true), 3000);
      return () => clearTimeout(timer);
    } else {
      setReady(false);
    }
  }, [isAuthenticated, user]);

  // Initialize real-time notifications with user settings
  // skip when not authenticated or during the startup deferral window
  useNotifications({
    skip: !ready,
    enablePantryNotifications: settings.pantryChanges,
    enableShoppingListNotifications: settings.shoppingListUpdates,
    enableMembershipNotifications: settings.homeInvites,
    enableLowStockAlerts: settings.lowStockAlerts,
    enableExpirationAlerts: settings.expirationNotifications,
    enableCollaborationNotifications: settings.collaborationInvites,
    showInAppNotifications: settings.pushEnabled,
    showPushNotifications: settings.pushEnabled,
  });

  // Returns null - no rendering, just side effects
  return null;
};

/**
 * NotificationProvider - Wraps app to enable notifications without re-rendering children.
 *
 * PERFORMANCE: Provider itself is static (no state/props), so it never re-renders.
 * NotificationListener handles all subscriptions and returns null, preventing
 * cascade re-renders to Navigation + all screens + BottomSheetModalProvider.
 */
export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  return (
    <>
      <NotificationListener />
      {children}
    </>
  );
};

export default NotificationProvider;
