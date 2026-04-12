import React from 'react';
import { useNotifications } from '#hooks/notifications/useNotifications';
import { useUser } from '#store/useAppStore';
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
 */
const NotificationListener: React.FC = () => {
  const user = useUser();
  const isAuthenticated = useAppStore(
    state => !!(state.user && state.accessToken),
  );

  useNotifications({ skip: !isAuthenticated || !user });

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
