import { useNetworkStatus } from '#hooks/useNetworkStatus';
import { useAppearance } from '#hooks/useAppearance';
import { useOnlineQueueSync } from '#hooks/app/useOnlineQueueSync';
import { useReconnectBackfill } from '#hooks/app/useReconnectBackfill';
import { useStartupInit } from '#hooks/app/useStartupInit';
import { useAppStateLifecycle } from '#hooks/app/useAppStateLifecycle';

/**
 * App-root lifecycle orchestrator. Order is load-bearing: appearance before
 * any paint, then network status, which populates the `isOnline` the
 * queue sync and reconnect backfill react to.
 */
export function useAppLifecycle(): void {
  useAppearance();
  useNetworkStatus();
  useOnlineQueueSync();
  useReconnectBackfill();
  useStartupInit();
  useAppStateLifecycle();
}
