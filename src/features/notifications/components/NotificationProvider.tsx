import React from 'react';
import { useNotificationListener } from '#features/notifications/hooks/useNotifications';
import { useUser } from '#store/useAppStore';
import { useAppStore } from '#store/useAppStore';

interface NotificationProviderProps {
  children: React.ReactNode;
}

/**
 * Holds the notification subscriptions as side effects. Returns null, so
 * re-rendering on notification/auth state changes reconciles nothing and
 * cannot cascade into the app tree.
 */
const NotificationListener: React.FC = () => {
  const user = useUser();
  const isAuthenticated = useAppStore(
    state => !!(state.user && state.accessToken),
  );

  // The ONLY mount point for the notification subscriptions — the server caps
  // concurrent subscriptions per client, so screens must use useNotifications
  // (store reads, no subscriptions) instead of mounting another listener.
  useNotificationListener({ skip: !isAuthenticated || !user });

  return null;
};

/** Static wrapper — it takes no state, so it never re-renders its children. */
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
