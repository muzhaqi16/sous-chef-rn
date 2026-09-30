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

interface PendingResync {
  sources: Set<RefetchSource>;
  matchers: Array<(query: ObservableQuery) => boolean>;
}

const hasLiveSession = (): boolean =>
  !!useStore.getState().user?.id && !LogoutCleanup.isInLogoutProcess();

async function runResync(
  client: ApolloClient,
  batch: PendingResync,
  closeBatch: () => void,
): Promise<void> {
  // Replay first: a refetch racing the queue would paint the server's older
  // values over writes that have not landed yet.
  // A rejection must still close the batch, or every later trigger joins it.
  await queueManager.whenIdle().catch(() => {});
  // Triggers from here on start the next resync; this one may already be past
  // the change they announce.
  closeBatch();

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
 * The client's resync: one per burst, since a trigger arriving while a resync
 * waits on the queue joins it, so each active query is re-requested at most
 * once. A transient query (a search, a preview, analytics) opts out with
 * `refetchOn: false`.
 */
export const createRefetchEventManager = (): RefetchEventManager => {
  let pending: PendingResync | null = null;

  // Returns synchronously, as a handler must; the queue wait is `runResync`'s.
  const coalescingHandler: RefetchEventManager.EventHandler = ({
    client,
    source,
    matchesRefetchOn,
  }) => {
    if (pending) {
      pending.sources.add(source);
      pending.matchers.push(matchesRefetchOn);
      return;
    }
    const batch: PendingResync = {
      sources: new Set([source]),
      matchers: [matchesRefetchOn],
    };
    pending = batch;
    void runResync(client, batch, () => {
      pending = null;
    });
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
