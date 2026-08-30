import { ApolloLink, Observable } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { useStore } from '#store';
import {
  isApiUnavailable,
  blocksCacheMissQueries,
} from '#store/slices/networkSlice';
import { logger } from '#/utils/environment';
import { Telemetry } from '#/services/telemetry';
import { t } from '#/i18n';

/**
 * Must always reach the network, even in offline mode: RefreshToken for token
 * rotation, GetUserSettings so offline mode itself can be toggled off.
 */
const ALWAYS_ALLOW = ['RefreshToken', 'GetUserSettings'];

/**
 * Short-circuits a query's network leg when it is unwanted or doomed. A cache
 * HIT re-emits and completes; a MISS forwards when only the breaker is open,
 * and errors explicitly when there is no network leg — emitting `{data: null}`
 * would make Apollo write `{}` and spam "Missing field".
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
      // `logger` is console-only and stripped from release, so this counter is
      // the only signal that distinguishes a working offline read session from
      // a broken one. `operation` is bounded by the persisted-query manifest.
      Telemetry.increment('offline_reads_served_total', 1, {
        operation: operationName,
      });
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
      Telemetry.increment('offline_reads_probed_total', 1, {
        operation: operationName,
      });
      return forward(operation);
    }

    // Cache miss, no network leg — explicit error result (blocks the `{}`
    // cache write; errorPolicy 'all' hands the hook a null-data error state).
    logger.info(
      `Offline link: cache miss for ${operationName} while offline — emitting error result`,
    );
    // The one the user actually feels: "This isn't available offline yet."
    // A rising rate here is the evidence that an entity's cached shape is
    // incomplete for the screen reading it — the failure mode the optimistic
    // completeness invariant exists to prevent.
    Telemetry.increment('offline_reads_blocked_total', 1, {
      operation: operationName,
    });
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
