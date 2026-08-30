import { ApolloLink, Observable, type DefaultContext } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { Kind, type DocumentNode } from 'graphql';
import { generateId } from '#/utils/generateId';
import { logger } from '#/utils/environment';
import { isNetworkError } from '#/utils/isNetworkError';
import { useStore } from '#store';
import { shouldTreatAsOffline } from '#store/slices/networkSlice';
import { queueStore } from './queueStore';
import { queueManager } from './queueManager';
import { hasSyncMapping } from './convertToSyncMutation';
import { OfflineRejectedError } from './OfflineRejectedError';
import { QueueCapacityError } from './types';
import { QueuedMutation, QueueStatus } from './types';

/**
 * Rides the queued result as `extensions.queuedReason` so `networkStatusLink`
 * can tell a REAL network failure (`'network-error'`, evidence the API is
 * unreachable) from a preemptive queue decision, which never touched the wire.
 */
export type QueuedReason = 'offline' | 'api-unreachable' | 'network-error';

/** Never queued, even offline. */
const NEVER_QUEUE_OPERATIONS = [
  'RefreshToken',
  'Login',
  'Register',
  'SignUp',
  'Logout',
  'VerifyEmail',
];

/**
 * Intercepts mutations and queues them for replay, but only those on the
 * `replayable` allowlist below: queuing anything else would toast a failure and
 * then ghost-execute the change on reconnect. A re-sent create is safe — its
 * client-minted CUID2 primary key resolves server-side to the same row.
 */
export const createQueueLink = () => {
  return new ApolloLink((operation, forward) => {
    if (!isMutation(operation)) {
      return forward(operation);
    }

    // `skipQueueLink` is how a replay avoids re-queuing itself.
    if (operation.getContext().skipQueueLink) {
      return forward(operation);
    }

    if (
      operation.operationName &&
      NEVER_QUEUE_OPERATIONS.includes(operation.operationName)
    ) {
      return forward(operation);
    }

    const state = useStore.getState();
    const localFirst = operation.getContext().localFirst === true;
    // Replay allowlist: local-first opt-ins (their hooks already wrote the
    // change to the cache and read the queued result as success) plus
    // Sync*-mapped idempotent upserts, which are safe without the opt-in.
    const replayable =
      localFirst || hasSyncMapping(operation.operationName ?? '');

    if (shouldTreatAsOffline(state)) {
      if (!replayable) {
        logger.info(
          `Queue Link: Offline, rejecting online-only mutation ${operation.operationName}`,
        );
        return new Observable(observer => {
          // Named so the reachability breaker and network-error telemetry skip
          // it: this rejection never touched the wire and proves nothing.
          observer.error(new OfflineRejectedError(operation.operationName));
        });
      }
      logger.info(
        `Queue Link: Offline, queuing mutation ${operation.operationName}`,
      );
      return new Observable(observer => {
        enqueueAndComplete(operation, observer, 'offline');
      });
    }

    // Breaker open while the device is online: queue instead of firing a doomed
    // request. Everything else falls through and surfaces its own error.
    if (state.apiReachable === false && replayable) {
      logger.info(
        `Queue Link: API unreachable, queuing replayable mutation ${operation.operationName}`,
      );
      return new Observable(observer => {
        enqueueAndComplete(operation, observer, 'api-unreachable');
      });
    }

    if (!localFirst) {
      return forward(operation);
    }

    // Local-first online: forward, but fall back to queuing on a genuine network
    // failure (no result received) so the change replays later. Any result — a
    // GraphQL or validation error included — propagates normally.
    return new Observable(observer => {
      let received = false;
      const subscription = forward(operation).subscribe({
        next: result => {
          received = true;
          observer.next(result);
          // Proof the API is reachable, covering the API-down-while-online
          // recovery the offline→online trigger misses. Debounced, and a no-op
          // on an empty queue.
          queueManager.requestDrain();
        },
        error: error => {
          if (!received && isNetworkError(error)) {
            logger.info(
              `Queue Link: Network error while online — queuing local-first mutation ${operation.operationName}`,
            );
            enqueueAndComplete(operation, observer, 'network-error');
          } else {
            observer.error(error);
          }
        },
        complete: () => observer.complete(),
      });
      return () => subscription.unsubscribe();
    });
  });
};

/**
 * Enqueues, then completes with a null-field result marked `queued`. The UI
 * change comes from the hook's own permanent cache write made before firing;
 * Apollo's `optimisticResponse` is never used here and never reaches a link.
 */
function enqueueAndComplete(
  operation: ApolloLink.Operation,
  observer: {
    next: (value: ApolloLink.Result) => void;
    error: (error: unknown) => void;
    complete: () => void;
  },
  reason: QueuedReason,
): void {
  try {
    const { user } = useStore.getState();
    if (!user) {
      observer.error(new Error('Cannot queue mutation: No authenticated user'));
      return;
    }

    const operationContext = operation.getContext();
    const operationName = operation.operationName || 'UnknownMutation';

    const queuedMutation: QueuedMutation = {
      id: generateId(),
      userId: user.id,
      operationName,
      mutation: operation.query,
      variables: operation.variables,
      context: pickPersistedContext(operationContext),
      status: QueueStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      requiresAuth: !NEVER_QUEUE_OPERATIONS.includes(operationName),
    };

    try {
      queueStore.addMutation(queuedMutation);
    } catch (error) {
      if (!(error instanceof QueueCapacityError)) throw error;
      // The local-first cache write already landed (write, then fire), so a
      // refused enqueue leaves the change on screen with nothing to send it.
      // Withdraw it as a refused replay would be.
      queueManager.withdrawUnqueueableWrite(queuedMutation, {
        type: 'unknown',
        message: 'Offline queue is full — change could not be queued',
        timestamp: Date.now(),
        retryable: false,
      });
      observer.error(error);
      return;
    }

    // Apollo writes a mutation result against its selection set, and a bare
    // `null`/`{}` makes InMemoryCache warn "Missing field <field>". A
    // present-but-null top-level field is a valid, quiet write instead.
    observer.next({
      data: buildQueuedResultData(operation.query),
      errors: undefined,
      extensions: { queued: true, queuedReason: reason },
    });
    observer.complete();

    logger.info(`Queue Link: Queued ${operationName} (${reason})`);
  } catch (error) {
    observer.error(error);
  }
}

/**
 * `localFirst` is the only context key a replay reads — idempotency rides on
 * `input.idempotencyKey` in the variables. Persisting the full Apollo context
 * would carry client internals that JSON silently drops, and a circular value
 * makes the MMKV write throw inside `saveQueue`, losing the enqueue.
 */
function pickPersistedContext(context: DefaultContext): DefaultContext {
  const persisted: DefaultContext = {};
  if (context.localFirst !== undefined) {
    persisted.localFirst = context.localFirst;
  }
  return persisted;
}

/**
 * Each top-level field set to `null` — see the call site. The classifier reads
 * a null payload field as "queued", a non-null non-success one as "rejected".
 */
function buildQueuedResultData(query: DocumentNode): Record<string, null> {
  const definition = getMainDefinition(query);
  const data: Record<string, null> = {};
  if (definition.kind === Kind.OPERATION_DEFINITION) {
    for (const selection of definition.selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        data[selection.alias?.value ?? selection.name.value] = null;
      }
    }
  }
  return data;
}

function isMutation(operation: { query: DocumentNode }): boolean {
  const definition = getMainDefinition(operation.query);
  return (
    definition.kind === 'OperationDefinition' &&
    definition.operation === 'mutation'
  );
}
