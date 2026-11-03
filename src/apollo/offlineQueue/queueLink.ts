import { ApolloLink, Observable, type DefaultContext } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { Kind, OperationTypeNode, type DocumentNode } from 'graphql';
import { generateId } from '#/utils/generateId';
import { logger } from '#/utils/environment';
import { Telemetry } from '#/services/telemetry';
import { isNetworkError } from '#/utils/isNetworkError';
import { isGatewayFault, isServerFault } from '#/utils/isServerFault';
import { useStore } from '#store';
import { shouldTreatAsOffline } from '#store/slices/networkSlice';
import { queueStore } from './queueStore';
import { queueManager } from './queueManager';
import { captureReplayInputs, hasReplayPreparation } from './prepareReplay';
import { dependencyIdsOf, holdsBack } from './queuedSubject';
import { OfflineRejectedError } from './OfflineRejectedError';
import { QUEUE_FULL_CODE, QueueCapacityError } from './types';
import type { QueuedMutation } from './types';
import { QueueStatus } from './types';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { scopesNamedBy } from '#/apollo/feed/feedRegistry';
import {
  pendingWritesOf,
  type PendingWrites,
} from '#/apollo/pendingWrites/pendingWrites';
import {
  LoginDocument,
  RefreshTokenDocument,
  RegisterDocument,
  VerifyEmailDocument,
} from '#operations/auth/auth.generated';

/**
 * Rides the queued result as `extensions.queuedReason` so `networkStatusLink`
 * can tell a REAL failure (`'network-error'` or `'gateway-fault'`, evidence the
 * API is unreachable) from one request breaking (`'server-fault'`) and from a
 * preemptive queue decision, which never touched the wire.
 */
export type QueuedReason =
  | 'offline'
  | 'api-unreachable'
  | 'network-error'
  | 'gateway-fault'
  | 'server-fault'
  | 'behind-queued';

/** Never queued, even offline. */
const NEVER_QUEUE_OPERATIONS = [
  RefreshTokenDocument,
  LoginDocument,
  RegisterDocument,
  VerifyEmailDocument,
].map(operationNameOf);

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
    // Replay allowlist: local-first opt-ins (their pending layers show the
    // change, and their hooks read the queued result as success) plus the
    // registered canonical writes, which are safe without the opt-in.
    const replayable =
      localFirst || hasReplayPreparation(operation.operationName ?? '');

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

    // Sent now, it would reach the server before the queued write it follows:
    // an edit before the create it names, or a stale version beside an
    // earlier one. So it queues behind them, as the drain holds a dependent.
    if (replayable && waitsBehindQueuedWrite(operation)) {
      logger.info(
        `Queue Link: ${operation.operationName} follows an undelivered write, queuing behind it`,
      );
      return new Observable(observer => {
        enqueueAndComplete(operation, observer, 'behind-queued');
        queueManager.drainAfterPass();
      });
    }

    if (!localFirst) {
      return forward(operation);
    }

    // Local-first online: saved first, so a killed app replays it, then
    // forwarded, falling back to the queue when no result came, from a network
    // failure or a 5xx. Any result, a GraphQL or validation error included,
    // propagates normally.
    return new Observable(observer => {
      const journaled = journalWrite(operation);
      let settled = false;
      const settle = () => {
        settled = true;
        if (journaled) queueStore.answered(journaled.id);
      };
      let received = false;
      const subscription = forward(operation).subscribe({
        next: result => {
          received = true;
          settle();
          queueManager.followAnsweredMerge(
            operation.operationName ?? '',
            operation.variables,
            result.data,
          );
          observer.next(result);
          // Proof the API is reachable, covering the API-down-while-online
          // recovery the offline→online trigger misses. Debounced, and a no-op
          // on an empty queue.
          queueManager.requestDrain();
        },
        error: error => {
          const reason = received ? null : queuedReasonFor(error);
          if (reason) {
            settled = true;
            logger.info(
              `Queue Link: ${reason} while online — queuing local-first mutation ${operation.operationName}`,
            );
            enqueueAndComplete(operation, observer, reason, journaled);
          } else {
            settle();
            observer.error(error);
          }
        },
        complete: () => observer.complete(),
      });
      return () => {
        subscription.unsubscribe();
        if (journaled && !settled) queueStore.handBack(journaled.id);
      };
    });
  });
};

/** A write as the queue holds it, with what it read when made. */
function entryFor(
  operation: ApolloLink.Operation,
  userId: string,
): QueuedMutation {
  const operationContext = operation.getContext();
  const operationName = operation.operationName ?? 'UnknownMutation';

  const queuedMutation: QueuedMutation = {
    id: generateId(),
    userId,
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
  // The row as the device holds it, for what a replay restates.
  const replayInputs = captureReplayInputs(
    queuedMutation,
    operation.client.cache,
  );
  if (replayInputs) queuedMutation.replayInputs = replayInputs;
  const pendingWrites = pendingWritesOf(operation.client.cache);
  const write = pendingWriteOf(operationContext, pendingWrites);
  if (write) {
    queuedMutation.pendingWrite = { id: write.id, inputs: write.inputs };
    const scopeIds = scopesNamedBy(operation.client.cache, [
      operation.variables,
      write.inputs,
    ]);
    if (scopeIds) queuedMutation.scopeIds = scopeIds;
    const orderedBy = orderOf(operation);
    if (orderedBy) queuedMutation.orderedBy = orderedBy;
  }
  return queuedMutation;
}

/**
 * Saves a write before it is sent. One that cannot be saved goes anyway: an
 * online person keeps the behaviour they had, and the counter shows it.
 */
function journalWrite(operation: ApolloLink.Operation): QueuedMutation | null {
  const { user } = useStore.getState();
  if (!user) return null;
  const operationName = operation.operationName ?? 'UnknownMutation';
  const startedAt = performance.now();
  try {
    const entry = entryFor(operation, user.id);
    if (queueStore.journal(entry)) return entry;
  } catch (error) {
    logger.error('Queue Link: could not save a write before sending it', error);
  } finally {
    Telemetry.histogram(
      'offline_queue_journal_ms',
      performance.now() - startedAt,
    );
  }
  Telemetry.increment('offline_queue_journal_failed_total', 1, {
    operation: operationName,
  });
  return null;
}

/** Why a local-first write that got no result queues; null when it should not. */
function queuedReasonFor(error: unknown): QueuedReason | null {
  if (isNetworkError(error)) return 'network-error';
  if (isGatewayFault(error)) return 'gateway-fault';
  return isServerFault(error) ? 'server-fault' : null;
}

/**
 * Enqueues, then completes with a null-field result marked `queued`. The UI
 * change is the write's pending layer, which stays until the replay answers.
 */
function enqueueAndComplete(
  operation: ApolloLink.Operation,
  observer: {
    next: (value: ApolloLink.Result) => void;
    error: (error: unknown) => void;
    complete: () => void;
  },
  reason: QueuedReason,
  journaled: QueuedMutation | null = null,
): void {
  try {
    const { user } = useStore.getState();
    if (!user) {
      observer.error(new Error('Cannot queue mutation: No authenticated user'));
      return;
    }

    const queuedMutation = journaled ?? entryFor(operation, user.id);
    const pendingWrites = pendingWritesOf(operation.client.cache);
    const write = pendingWriteOf(operation.getContext(), pendingWrites);

    try {
      if (journaled) queueStore.handBack(journaled.id);
      else queueStore.addMutation(queuedMutation);
    } catch (error) {
      if (!(error instanceof QueueCapacityError)) throw error;
      // The write's layer is on screen, so a refused enqueue would leave the
      // change showing with nothing to send it. Withdraw it as a refused
      // replay would be.
      queueManager.withdrawUnqueueableWrite(queuedMutation, {
        type: 'unknown',
        message: 'Offline queue is full — change could not be queued',
        code: QUEUE_FULL_CODE,
        timestamp: Date.now(),
        retryable: false,
      });
      observer.error(error);
      return;
    }
    if (write) pendingWrites.markQueued(write.id);
    // The enqueue may have superseded earlier writes: their layers go with them.
    pendingWrites.keepQueued(() => queueStore.getQueuedWriteIds());

    // Apollo writes a mutation result against its selection set, and a bare
    // `null`/`{}` makes InMemoryCache warn "Missing field <field>". A
    // present-but-null top-level field is a valid, quiet write instead.
    observer.next({
      data: buildQueuedResultData(operation.query),
      errors: undefined,
      extensions: { queued: true, queuedReason: reason },
    });
    observer.complete();

    logger.info(`Queue Link: Queued ${operation.operationName} (${reason})`);
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
  const localFirst: unknown = context.localFirst;
  if (localFirst !== undefined) {
    persisted.localFirst = localFirst;
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

function pendingWriteOf(context: DefaultContext, pendingWrites: PendingWrites) {
  const { pendingWriteId } = context;
  return typeof pendingWriteId === 'string'
    ? pendingWrites.get(pendingWriteId)
    : undefined;
}

/** Read off the variables sent: a check-in learns its store only then. */
function orderOf(operation: ApolloLink.Operation): string | undefined {
  const pendingWrites = pendingWritesOf(operation.client.cache);
  const write = pendingWriteOf(operation.getContext(), pendingWrites);
  return write
    ? pendingWrites.orderOf({ ...write, variables: operation.variables })
    : undefined;
}

function waitsBehindQueuedWrite(operation: ApolloLink.Operation): boolean {
  const undelivered = queueStore.getUndeliveredIds();
  if (undelivered.size === 0) return false;
  const write = {
    mutation: operation.query,
    variables: operation.variables,
    orderedBy: orderOf(operation),
  };
  return [...holdsBack(write), ...dependencyIdsOf(write)].some(id =>
    undelivered.has(id),
  );
}

function isMutation(operation: { query: DocumentNode }): boolean {
  const definition = getMainDefinition(operation.query);
  return (
    definition.kind === Kind.OPERATION_DEFINITION &&
    definition.operation === OperationTypeNode.MUTATION
  );
}
