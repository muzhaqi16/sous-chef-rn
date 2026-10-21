import { useAppStateLifecycle } from '#hooks/app/useAppStateLifecycle';
import { useNetworkStatusSync } from '#hooks/app/useNetworkStatusSync';
import { useOnlineQueueSync } from '#hooks/app/useOnlineQueueSync';
import { usePendingRevocationDrain } from '#hooks/app/usePendingRevocationDrain';
import { NO_STARTUP_HOST, type StartupHost } from './startupHost';
import { useCoreStartup } from './useCoreStartup';

/**
 * Everything the core runs for the life of the app, at the host's root, with
 * the start-up steps the host adds, if any. Order is load-bearing: network
 * status first, which populates the `isOnline` the queue sync and the client's
 * resync react to.
 */
export function useCoreLifecycle(host: StartupHost = NO_STARTUP_HOST): void {
  useNetworkStatusSync();
  useOnlineQueueSync();
  usePendingRevocationDrain();
  useCoreStartup(host);
  useAppStateLifecycle();
}
