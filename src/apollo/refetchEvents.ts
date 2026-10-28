import {
  Observable,
  RefetchEventManager,
  type ApolloClient,
  type ObservableQuery,
  type RefetchEvents,
} from '@apollo/client';
import { requirePlatform } from '#platform/install';
import { useStore } from '#store';
import {
  isApiUnavailable,
  isNetworkWithheld,
} from '#store/slices/networkSlice';
import { queueManager } from './offlineQueue/queueManager';
import { LogoutCleanup } from './logoutCleanup';
import { isLiveChannelOpen, onWebSocketReconnected } from './links/wsLink';
import { Telemetry } from '#services/telemetry';
import { getResolvedLanguage, onLanguageChanged } from '#/i18n';
import {
  startAnswersForSwitch,
  wasAnsweredSinceSwitch,
  wasAnsweredWholeSinceSwitch,
} from './answeredSinceSwitch';
import { fragmentsCarried, fragmentsNeeded } from './fragmentsOnEntities';
import { logger } from '#/utils/environment';
import { RESYNC_SCOPE } from './scopedClient';

type RefetchSource = keyof RefetchEvents;

/** The scope on screen: its name, null for none, undefined while unknown. */
export type ScopeOnScreen = () => string | null | undefined;

// The host's, from `connectResyncSources`; without one every query is shown.
let scopeOnScreen: ScopeOnScreen = () => undefined;
// Starts the navigation catch-ups, once something is left to catch up.
let catchUpOnNavigation = (): void => {};

// A screen kept mounted while hidden (a home tab) keeps its queries active, so
// only its scope tells a resync to leave them for when it is shown.
const isOnScreen = (query: ObservableQuery): boolean => {
  const scope: unknown = query.options.context?.[RESYNC_SCOPE];
  if (typeof scope !== 'string') return true;
  const shown = scopeOnScreen();
  return shown === undefined || shown === scope;
};

// The API ends a socket that leaves one of its pings unanswered at the next
// (WS_PING_INTERVAL_MS, 30 s: sous-chef-api packages/core/src/context/ws.ts),
// and the device may never see the close.
const SERVER_LIVENESS_WINDOW_MS = 2 * 30_000;

/**
 * Three moments the device may have missed changes: the live-event channel
 * only delivers what happens after it connects. Each wraps a signal the app
 * already has; none adds a probe.
 *
 * A return inside the liveness window over a channel still open missed
 * nothing: the server held its subscriptions, and a drop reconnects and
 * resyncs on its own. Past it the server may have let them go, and answers
 * that move with the clock (expiry counts, the day's plan) carry no event.
 */
const appForeground = () =>
  new Observable<void>(observer => {
    const lifecycle = requirePlatform('appLifecycle');
    let lastState = lifecycle.current();
    let leftAt = Date.now();
    return lifecycle.subscribe(nextState => {
      const wasAway = lastState === 'inactive' || lastState === 'background';
      if (lastState === 'active' && nextState !== 'active') leftAt = Date.now();
      lastState = nextState;
      if (nextState !== 'active' || !wasAway) return;
      if (
        !isLiveChannelOpen() ||
        Date.now() - leftAt >= SERVER_LIVENESS_WINDOW_MS
      ) {
        observer.next();
      }
    });
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

const hasLiveSession = (): boolean =>
  !!useStore.getState().user?.id && !LogoutCleanup.isInLogoutProcess();

// Offline a catch-up would only fail: `apiReachable` re-asks what is active.
// In offline mode the link answers every query before it is recorded, so each
// navigation would drain the queue to refetch the cache.
const canCatchUp = (): boolean =>
  hasLiveSession() && !isNetworkWithheld(useStore.getState());

// Catalog names come in the request's language, so a switch re-reads the
// screen and each later navigation catches up the rest. Only a real change
// counts: i18next repeats the language, and rehydration precedes queries.
const languageChanged = (client: ApolloClient) => () =>
  new Observable<RefetchEvents['languageChanged']>(observer => {
    let current = getResolvedLanguage();
    return onLanguageChanged(() => {
      const next = getResolvedLanguage();
      if (next === current) return;
      current = next;
      if (client.getObservableQueries('all').size === 0) return;
      // What was answered before the switch is in the old language.
      startAnswersForSwitch();
      catchUpOnNavigation();
      observer.next();
    });
  });

// Whatever the household holds the caller reached as a member, so leaving
// changes what every screen of it shows, as a resync does.
let householdLeft = (): void => {};

/** The caller left a home or was removed from one: resync what the app shows. */
export const announceHouseholdLeft = (): void => householdLeft();

const householdLeftSource = () =>
  new Observable<RefetchEvents['householdLeft']>(observer => {
    householdLeft = () => observer.next();
    return () => {
      householdLeft = () => {};
    };
  });

// After a switch or a resync, each navigation re-asks what it shows that was
// left unasked: a paused screen resuming, or a home tab hidden at the time.
const screenShown = (onNavigation?: NavigationSubscribe) => () =>
  new Observable<RefetchEvents['screenShown']>(observer => {
    let stopNavigation: (() => void) | undefined;
    catchUpOnNavigation = () => {
      stopNavigation ??= onNavigation?.(() => {
        if (canCatchUp()) observer.next();
      });
    };
    return () => {
      stopNavigation?.();
      catchUpOnNavigation = () => {};
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

const isCatchUp = (batch: PendingResync): boolean =>
  [...batch.sources].every(
    name => name === 'languageChanged' || name === 'screenShown',
  );

const answeredSinceSwitch = (query: ObservableQuery): boolean =>
  !!query.queryName && wasAnsweredSinceSwitch(query.queryName, query.variables);

const answeredWholeSinceSwitch = (query: ObservableQuery): boolean =>
  !!query.queryName &&
  wasAnsweredWholeSinceSwitch(query.queryName, query.variables);

/**
 * A query made only of fragments that a query answered whole since the switch
 * holds on the same entities was answered with it: a scan card's hooks read
 * what the barcode lookup brought.
 */
function answeredWithAnother(
  client: ApolloClient,
): (query: ObservableQuery) => boolean {
  let carried: Set<string> | undefined;
  return query => {
    const needed = fragmentsNeeded(
      query.query,
      query.variables,
      query.getCurrentResult().data,
    );
    if (!needed) return false;
    const held = (carried ??= new Set(
      [...client.getObservableQueries('active')].flatMap(carrier =>
        answeredWholeSinceSwitch(carrier)
          ? [
              ...fragmentsCarried(
                carrier.query,
                carrier.variables,
                carrier.getCurrentResult().data,
              ),
            ]
          : [],
      ),
    ));
    return [...needed].every(key => held.has(key));
  };
}

// What is on screen and not answered since the last switch or resync, whoever
// asked. A resync starts afresh, so it re-asks all that is shown. A query held
// to the cache is never sent by `refetchQueries`, so it is never answered.
const reasks = (client: ApolloClient, batch: PendingResync) => {
  const answeredWith = answeredWithAnother(client);
  return (query: ObservableQuery): boolean =>
    query.options.fetchPolicy !== 'cache-only' &&
    batch.matchers.some(matcher => matcher(query)) &&
    isOnScreen(query) &&
    !answeredSinceSwitch(query) &&
    !answeredWith(query);
};

async function refetchActive(
  client: ApolloClient,
  batch: PendingResync,
): Promise<void> {
  const source = [...batch.sources].sort().join('+');
  if (!(isCatchUp(batch) ? canCatchUp() : hasLiveSession())) return;
  if (!isCatchUp(batch)) {
    // Anything answered before now may have missed a change.
    startAnswersForSwitch();
    catchUpOnNavigation();
  }
  const wanted = reasks(client, batch);
  let refetched = 0;
  try {
    await client.refetchQueries({
      include: 'active',
      onQueryUpdated: query => {
        if (!wanted(query)) return false;
        refetched++;
        return true;
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
 * Triggers until a settle window passes quietly are one resync, as is one
 * arriving while it waits on the queue; one arriving while it re-requests
 * starts one more after it. A transient query opts out with `refetchOn: false`.
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
    // A catch-up after a navigation mostly finds every active query asked
    // since the switch: then it touches neither the queue nor the network.
    if (
      pending &&
      isCatchUp(pending) &&
      ![...client.getObservableQueries('active')].some(reasks(client, pending))
    ) {
      takePending();
      running = false;
      return;
    }
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
  const coalescingHandler: RefetchEventManager.EventHandler = context => {
    const { client, source, matchesRefetchOn } = context;
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
 * Called once at app start, not from `client.ts`: a source subscribes as it is
 * set, and importing the client must not subscribe to the store, the app
 * lifecycle and the socket.
 */
export const connectResyncSources = (
  client: ApolloClient,
  {
    onNavigation,
    scopeOnScreen: shown,
  }: { onNavigation?: NavigationSubscribe; scopeOnScreen?: ScopeOnScreen } = {},
): void => {
  const manager = client.refetchEventManager;
  if (!manager) return;
  scopeOnScreen = shown ?? (() => undefined);
  manager.setEventSource('appForeground', appForeground);
  manager.setEventSource('apiReachable', apiReachable);
  manager.setEventSource('wsReconnected', wsReconnected);
  manager.setEventSource('languageChanged', languageChanged(client));
  manager.setEventSource('householdLeft', householdLeftSource);
  manager.setEventSource('screenShown', screenShown(onNavigation));
};
