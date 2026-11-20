import { useEffect } from 'react';
import { useNotificationStore } from '#features/notifications/store/notificationStore';
import { useNotificationSync } from './useNotificationSync';

/**
 * Marks read the notification a person opened from its push, once the
 * signed-in app is there to write it, as opening it from the list does.
 */
export function useMarkPushOpenedRead() {
  const opened = useNotificationStore(state => state.openedFromPush);
  const { syncMarkAsRead } = useNotificationSync();

  useEffect(() => {
    if (!opened) return;
    useNotificationStore.getState().noteOpenedFromPush(null);
    void syncMarkAsRead(opened);
  }, [opened, syncMarkAsRead]);
}
