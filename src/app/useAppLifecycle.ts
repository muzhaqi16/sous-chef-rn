import { useAppearance } from '#hooks/ui/useAppearance';
import { useOnlineQueueSync } from '#hooks/app/useOnlineQueueSync';
import { useNetworkStatusSync } from '#hooks/app/useNetworkStatusSync';
import { usePendingRevocationDrain } from '#hooks/app/usePendingRevocationDrain';
import { useStartupInit } from './useStartupInit';
import { useAppStateLifecycle } from '#hooks/app/useAppStateLifecycle';

/**
 * App-root lifecycle orchestrator. Order is load-bearing: appearance before
 * any paint, then network status, which populates the `isOnline` the
 * queue sync and the client's resync react to.
 */
export function useAppLifecycle(): void {
  useAppearance();
  useNetworkStatusSync();
  useOnlineQueueSync();
  usePendingRevocationDrain();
  useStartupInit();
  useAppStateLifecycle();
}
