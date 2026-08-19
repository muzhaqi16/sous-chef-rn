import { ApolloLink, Observable } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { useStore } from '#store';
import {
  isApiUnavailable,
  blocksCacheMissQueries,
} from '#store/slices/networkSlice';
import { logger } from '#/utils/environment';
import { t } from '#/i18n';

/**
 * Operations that must always reach the network, even in offline mode.
 * - RefreshToken: Required for auth token rotation
 * - GetUserSettings: Required to sync settings changes (including toggling offline mode off)
 */
const ALWAYS_ALLOW = ['RefreshToken', 'GetUserSettings'];

/**
 * Apollo Link that short-circuits query network requests when the network leg
 * is unwanted or doomed — the user enabled offline mode, the device is
 * offline, or the API-reachability circuit breaker is open. Apollo has
 * already read from cache before the link chain fires, so blocking serves
 * cached data without firing a doomed request (and without the
 * retryLink/errorLink retry+warn noise that doomed attempts produce).
 *
 * Decision matrix for queries:
 * - Cache HIT: emit the cached data and complete — no network request.
 *   Apollo Client 4.x requires a link to emit a value before completing, and
 *   re-emitting cached data is an idempotent write that never clobbers the
 *   populated cache. The query settles with no spinner and no error.
 * - Cache MISS while the circuit breaker is open (device online, offline mode
 *   off): FORWARD to the network. Blocking would render an empty screen
 *   anyway, and emitting `{ data: null }` makes Apollo 4 write `{}` against
 *   the selection set (`shouldWriteResult` passes an error-free result;
 *   `writeToStore` coerces `result || {}`), spamming "Missing field X while
 *   writing result {}". Forwarding doubles as an organic probe: a success
 *   closes a spuriously-open circuit via recordSuccess; a failure feeds the
 *   breaker the failure it already believes in.
 * - Cache MISS with no network leg available (device offline / offline mode
 *   on): emit an explicit error result. The error stops Apollo's cache write
 *   (no "Missing field" spam) and errorPolicy 'all' surfaces an honest
 *   "unavailable offline" to the hook instead of a silent null.
 * - Mutations: pass through to queueLink which handles offline queuing.
 * - Subscriptions: pass through (WebSocket owns its own lifecycle).
 *
 * `isOnline` errs toward "online" (only false when NetInfo is confident the
 * device is offline), so a transient unknown state doesn't wrongly block.
 *
 * This approach avoids the query cascade issue caused by dynamic fetchPolicy
 * changes (see docs/apollo-client-patterns.md "Why NOT useOfflinePresetPolicy").
 */
export const createOfflineModeLink = () => {
  return new ApolloLink((operation, forward) => {
    const state = useStore.getState();
    if (!state.offlineModeEnabled && !isApiUnavailable(state)) {
      return forward(operation);
    }

    // Allow-listed operations always pass through
    const operationName = operation.operationName || '';
    if (ALWAYS_ALLOW.includes(operationName)) {
      return forward(operation);
    }

    const definition = getMainDefinition(operation.query);

    // Only block queries — mutations queue via queueLink, subscriptions manage themselves
    if (
      definition.kind !== 'OperationDefinition' ||
      definition.operation !== 'query'
    ) {
      return forward(operation);
    }

    let cached: Record<string, unknown> | null = null;
    try {
      cached = operation.client.cache.readQuery<Record<string, unknown>>({
        query: operation.query,
        variables: operation.variables,
      });
    } catch {
      cached = null;
    }

    // Cache hit — serve it (idempotent re-write, see matrix above).
    if (cached !== null) {
      const data = cached;
      logger.debug(`Offline link: served ${operationName} from cache`);
      return new Observable<ApolloLink.Result>(observer => {
        observer.next({ data });
        observer.complete();
      });
    }

    // Cache miss, circuit-open-only — forward as an organic probe.
    if (!blocksCacheMissQueries(state)) {
      logger.info(
        `🔌 Offline link: cache miss for ${operationName} while the circuit is open — forwarding as a probe`,
      );
      return forward(operation);
    }

    // Cache miss, no network leg — explicit error result (blocks the `{}`
    // cache write; errorPolicy 'all' hands the hook a null-data error state).
    logger.info(
      `Offline link: cache miss for ${operationName} while offline — emitting error result`,
    );
    return new Observable<ApolloLink.Result>(observer => {
      observer.next({
        data: null,
        errors: [
          {
            // Surfaced to the user verbatim by screens that render
            // `error.message`, so it stays localized and free of internals —
            // the operation name is in the log line above, not here.
            message: t(
              'offline.noCachedData',
              "This isn't available offline yet. Reconnect to load it.",
            ),
          },
        ],
      });
      observer.complete();
    });
  });
};
