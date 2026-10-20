import { useEffect } from 'react';
import { registerFcmTapHandlers } from '#/services/push/nativePushMessaging';
import { registerIosPushTapHandlers } from '#/services/push/iosPushMessaging';

/**
 * Taps on OS-displayed pushes; data-only pushes go through Notifee. Gated on a
 * session: registering consumes the one-shot cold-start tap, which stays cached
 * until this effect re-runs.
 */
export function usePushTapHandlers(userId: string | undefined): void {
  useEffect(() => {
    if (!userId) return;
    const unsubscribeFcm = registerFcmTapHandlers();
    const unsubscribeApns = registerIosPushTapHandlers();
    return () => {
      unsubscribeFcm();
      unsubscribeApns();
    };
  }, [userId]);
}
