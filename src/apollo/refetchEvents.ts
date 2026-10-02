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
import { getResolvedLanguage, onLanguageChanged } from '#/i18n';
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

/** Subscribes to navigation state changes; returns the unsubscribe. */
export type NavigationSubscribe = (listener: () => void) => () => void;

// Catalog names come in the request's language (`languageLink`), so a switch
// re-reads what is on screen. A screen paused at the switch is not active, so
// no refetch reaches it, and on resume it reads the cache: after a switch,
// every navigation catches up on what has not been asked since.
// Only a real change counts: i18next also reports a switch to the same
// language, and rehydration applies the saved one before any query exists.
const languageChanged =
  (client: ApolloClient, onNavigation?: NavigationSubscribe) => () =>
    new Observable<RefetchEvents['languageChanged']>(observer => {
      let current = getResolvedLanguage();
      let stopNavigation: (() => void) | undefined;
      const stopLanguage = onLanguageChanged(() => {
        const next = getResolvedLanguage();
        if (next === current) return;
        current = next;
        if (client.getObservableQueries('all').size === 0) return;
        stopNavigation ??= onNavigation?.(() =>
          observer.next({ switched: false }),
        );
        observer.next({ switched: true });
      });
      return () => {
        stopLanguage();
        stopNavigation?.();
      };
    });

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

/**
 * The queries a resync has re-asked, with an answer, since the last language
 * switch; a switch starts a new set. Per switch, not per language: the names
 * are shared entities, so a screen paused through `en` → `es` → `en` holds
 * what the `es` screens wrote.
 */
type AskedSinceSwitch = WeakSet<ObservableQuery>;

async function refetchActive(
  client: ApolloClient,
  batch: PendingResync,
  asked: AskedSinceSwitch,
): Promise<void> {
  if (!hasLiveSession()) return;

  const source = [...batch.sources].sort().join('+');
  // A language catch-up re-asks only what has not been asked since the switch;
  // any other trigger re-asks everything.
  const catchUp = [...batch.sources].every(name => name === 'languageChanged');
  // Offline it would only fail: `apiReachable` re-asks what is active.
  if (catchUp && isApiUnavailable(useStore.getState())) return;
  let refetched = 0;
  try {
    await client.refetchQueries({
      include: 'active',
      onQueryUpdated: query => {
        if (
          !batch.matchers.some(matcher => matcher(query)) ||
          (catchUp && asked.has(query))
        ) {
          return false;
        }
        refetched++;
        // Asked once answered: a failed ask is caught up on a later navigation.
        return query.refetch().then(result => {
          if (!result.error) asked.add(query);
          return result;
        });
      },
    });
  } catch (error) {
    // A flaky reconnect can reject single refetches; the next trigger retries.
    logger.debug('Resync did not complete cleanly:', error);
  }

  // A catch-up after every navigation mostly finds nothing to ask.
  if (refetched === 0) return;
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
  let asked: AskedSinceSwitch = new WeakSet();
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
    if (batch) await refetchActive(client, batch, asked).catch(() => {});
    running = false;
    if (pending) settleThenResync(client, pending);
  };

  // Returns synchronously, as a handler must; the waits are `resync`'s.
  const coalescingHandler: RefetchEventManager.EventHandler = context => {
    const { client, source, matchesRefetchOn } = context;
    // A run in flight keeps the set it started with: it asked in the old language.
    if (context.source === 'languageChanged' && context.payload.switched) {
      asked = new WeakSet();
    }
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
 * Starts the triggers. Called once at app start rather than from
 * `client.ts`: a source subscribes as it is set, and importing the client must
 * not subscribe to the store, AppState and the socket. `onNavigation` comes
 * from the composition root, which owns navigation.
 */
export const connectResyncSources = (
  client: ApolloClient,
  { onNavigation }: { onNavigation?: NavigationSubscribe } = {},
): void => {
  const manager = client.refetchEventManager;
  if (!manager) return;
  manager.setEventSource('appForeground', appForeground);
  manager.setEventSource('apiReachable', apiReachable);
  manager.setEventSource('wsReconnected', wsReconnected);
  manager.setEventSource(
    'languageChanged',
    languageChanged(client, onNavigation),
  );
};
