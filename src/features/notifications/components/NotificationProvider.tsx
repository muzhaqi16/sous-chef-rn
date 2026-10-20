import React from 'react';
import { Platform } from 'react-native';
import {
  useNotificationListener,
  type AwayNotification,
} from '#features/notifications/hooks/useNotifications';
import { showLocalNotification } from '#/services/notifications/localNotificationHelper';
import { useUser } from '#store/useAppStore';
import { useAppStore } from '#store/useAppStore';
import { usePushTapHandlers } from './usePushTapHandlers';

interface NotificationProviderProps {
  children: React.ReactNode;
}

/**
 * Android only: on iOS the OS already draws the APNs alert for the same event,
 * so a Notifee draw here would double the tray entry.
 */
const drawWhileAway = (notification: AwayNotification): void => {
  if (Platform.OS !== 'android') return;
  void showLocalNotification({
    id: notification.id,
    title: notification.title,
    body: notification.body,
    data: {
      category: notification.category,
      notificationId: notification.id,
    },
  });
};

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
  const skip = !isAuthenticated || !user;
  useNotificationListener({ skip, onArrivedWhileAway: drawWhileAway });
  usePushTapHandlers(skip ? undefined : user.id);

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
