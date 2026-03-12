import React, { useState, useEffect } from 'react';
import { useNotifications } from '#hooks/notifications/useNotifications';
import { useAuthUser } from '#hooks/auth/useAuthUser';
import { useAppStore } from '#store/useAppStore';

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
 *
 * STARTUP PRIORITY: useNotifications defers both the GetNotificationPreferences query
 * and the WebSocket subscription until 3s after authentication, so they don't compete
 * with critical startup queries (GetHomes, GetPantry). Settings defaults cover the gap.
 */
const NotificationListener: React.FC = () => {
  const user = useAuthUser();
  const isAuthenticated = useAppStore(state => !!(state.user && state.accessToken));

  // Defer subscription + preferences query by 3s to avoid competing with startup queries
  const [ready, setReady] = useState(false);

  // Render-time reset: clear ready state when user logs out
  const [prevIsAuthenticated, setPrevIsAuthenticated] = useState(isAuthenticated);
  if (isAuthenticated !== prevIsAuthenticated) {
    setPrevIsAuthenticated(isAuthenticated);
    if (!isAuthenticated) {
      setReady(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated && user) {
      const timer = setTimeout(() => setReady(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user]);

  useNotifications({ skip: !ready });

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
