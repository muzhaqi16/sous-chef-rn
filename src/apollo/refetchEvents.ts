import {
  Observable,
  RefetchEventManager,
  type ApolloClient,
  type ObservableQuery,
  type RefetchEvents,
} from '@apollo/client';
import { AppState } from 'react-native';
import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { queueManager } from './offlineQueue/queueManager';
import { LogoutCleanup } from './logoutCleanup';
import { onWebSocketReconnected } from './links/wsLink';
import { Telemetry } from '#services/telemetry';
import { logger } from '#/utils/environment';

type RefetchSource = keyof RefetchEvents;

/**
 * Three moments the device may have missed changes: the live-event channel
 * only delivers what happens after it connects. Each wraps a signal the app
 * already has; none adds a probe.
 */
const appForeground = () =>
  new Observable<void>(observer => {
    let lastState = AppState.currentState;
    const subscription = AppState.addEventListener('change', nextState => {
      const wasAway = /inactive|background/.test(lastState);
      lastState = nextState;
      if (nextState === 'active' && wasAway) observer.next();
    });
    return () => subscription.remove();
  });

const apiReachable = () =>
  new Observable<void>(observer => {
    let wasUnavailable = isApiUnavailable(useStore.getState());
    return useStore.subscribe(state => {
      const unavailable = isApiUnavailable(state);
      if (wasUnavailable && !unavailable) observer.next();
      wasUnavailable = unavailable;
    });
  });

const wsReconnected = () =>
  new Observable<void>(observer =>
    onWebSocketReconnected(() => observer.next()),
  );

// The socket re-acks a second or two after the app returns to the foreground.
const SETTLE_MS = 1_500;
// A steady trickle of triggers still resyncs.
const MAX_SETTLE_MS = 5_000;

interface PendingResync {
  sources: Set<RefetchSource>;
  matchers: Array<(query: ObservableQuery) => boolean>;
  firstTriggerAt: number;
}

const hasLiveSession = (): boolean =>
  !!useStore.getState().user?.id && !LogoutCleanup.isInLogoutProcess();

async function refetchActive(
  client: ApolloClient,
  batch: PendingResync,
): Promise<void> {
  if (!hasLiveSession()) return;

  const source = [...batch.sources].sort().join('+');
  let refetched = 0;
  try {
    await client.refetchQueries({
      include: 'active',
      onQueryUpdated: query => {
        const matches = batch.matchers.some(matcher => matcher(query));
        if (matches) refetched++;
        return matches;
      },
    });
  } catch (error) {
    // A flaky reconnect can reject single refetches; the next trigger retries.
    logger.debug('Resync did not complete cleanly:', error);
  }

  logger.info(`🔄 Resync (${source}): refetched ${refetched} active quer(ies)`);
  Telemetry.increment('resync_queries_total', refetched, { source });
}

/**
 * The client's resync. Triggers until a settle window passes quietly are one
 * resync, and so is a trigger arriving while it waits on the queue; one
 * arriving while it re-requests starts exactly one more after it, never a
 * parallel run. A transient query (a search, a preview, analytics) opts out
 * with `refetchOn: false`.
 */
export const createRefetchEventManager = (): RefetchEventManager => {
  let pending: PendingResync | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  // From the settle timer firing until its refetch settles.
  let running = false;

  const takePending = (): PendingResync | null => {
    const batch = pending;
    pending = null;
    return batch;
  };

  const settleThenResync = (client: ApolloClient, batch: PendingResync) => {
    clearTimeout(settleTimer);
    const capLeft = batch.firstTriggerAt + MAX_SETTLE_MS - Date.now();
    settleTimer = setTimeout(() => {
      void resync(client);
    }, Math.min(SETTLE_MS, Math.max(0, capLeft)));
  };

  const resync = async (client: ApolloClient) => {
    running = true;
    // Replay first: a refetch racing the queue would paint the server's older
    // values over writes that have not landed yet.
    await queueManager.whenIdle().catch(() => {});
    const batch = takePending();
    // A throw must still end the run, or every later trigger waits on it.
    if (batch) await refetchActive(client, batch).catch(() => {});
    running = false;
    if (pending) settleThenResync(client, pending);
  };

  // Returns synchronously, as a handler must; the waits are `resync`'s.
  const coalescingHandler: RefetchEventManager.EventHandler = ({
    client,
    source,
    matchesRefetchOn,
  }) => {
    pending ??= {
      sources: new Set(),
      matchers: [],
      firstTriggerAt: Date.now(),
    };
    pending.sources.add(source);
    pending.matchers.push(matchesRefetchOn);
    if (!running) settleThenResync(client, pending);
  };

  return new RefetchEventManager({ defaultHandler: coalescingHandler });
};

/**
 * Starts the three triggers. Called once at app start rather than from
 * `client.ts`: a source subscribes as it is set, and importing the client must
 * not subscribe to the store, AppState and the socket.
 */
export const connectResyncSources = (client: ApolloClient): void => {
  const manager = client.refetchEventManager;
  if (!manager) return;
  manager.setEventSource('appForeground', appForeground);
  manager.setEventSource('apiReachable', apiReachable);
  manager.setEventSource('wsReconnected', wsReconnected);
};
