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
import { OfflineRejectedError } from './OfflineRejectedError';
import { QueueCapacityError } from './types';
import { QueuedMutation, QueueStatus } from './types';
import type { WriteConvergence } from './types';
import type { WriteIntent } from '#/apollo/write/writeIntent';

/**
 * Why a mutation was queued instead of fired. Carried on the queued result as
 * `extensions.queuedReason` so `networkStatusLink` can tell a REAL network
 * failure (`'network-error'` — evidence the API is unreachable) from a
 * preemptive queue decision (`'offline'` / `'api-unreachable'` — the mutation
 * never touched the network, so it proves nothing about the API).
 */
export type QueuedReason = 'offline' | 'api-unreachable' | 'network-error';

/**
 * Operations that should never be queued (even when offline)
 */
const NEVER_QUEUE_OPERATIONS = [
  'RefreshToken',
  'Login',
  'Register',
  'SignUp',
  'Logout',
  'VerifyEmail',
];

/**
 * Queue Link - Intercepts mutations and queues them for replay.
 *
 * Behavior:
 * - **Offline** (`isOnline === false`): queue immediately and complete without
 *   hitting the network — but ONLY for mutations on the replay allowlist:
 *   `context.localFirst` opt-ins (their hooks wrote the change to the cache
 *   permanently and treat the queued result as success) or operations with a
 *   `Sync*` replay mapping (idempotent upserts, safe even without the opt-in).
 *   Every other mutation fails fast with a network error so its hook surfaces
 *   an HONEST failure — queueing it would show a failure toast and then
 *   ghost-execute the change on reconnect (reviews, invites, etc.).
 * - **Online but the request fails with a NETWORK error** (API unreachable while
 *   the device still reports "online" — API down, timeout, captive portal): queue
 *   the mutation for replay instead of surfacing the error — but ONLY for the same
 *   replay allowlist as the offline path (`context.localFirst` opt-ins or
 *   `Sync*`-mapped idempotent operations). Un-migrated mutations keep their
 *   current behavior (blocking alert + revert). Creates are safe to queue because
 *   each carries a client-generated permanent id (CUID v1) as its primary key, so
 *   a re-sent create resolves to the same row server-side (find-by-id → update)
 *   rather than duplicating — see docs/local-first-architecture.md.
 * - **Online + success / GraphQL (non-network) error**: pass through normally so
 *   real validation/permission errors still reach the hook.
 * - Auth-aware (associates mutations with the current user) and idempotent
 *   (skips replays via `skipQueueLink`).
 */
export const createQueueLink = () => {
  return new ApolloLink((operation, forward) => {
    // Only process mutations
    if (!isMutation(operation)) {
      return forward(operation);
    }

    // Skip if explicitly told to skip queue (for replays)
    if (operation.getContext().skipQueueLink) {
      return forward(operation);
    }

    // Skip operations that should never be queued
    if (
      operation.operationName &&
      NEVER_QUEUE_OPERATIONS.includes(operation.operationName)
    ) {
      return forward(operation);
    }

    const state = useStore.getState();
    const localFirst = operation.getContext().localFirst === true;
    // The replay allowlist is the explicit opt-in, and nothing else. It used
    // to also admit anything with a `Sync*` twin, which meant an operation
    // could be queued without its hook ever asking to be — including hooks
    // pairing an `optimisticResponse` with it, which reverts on screen the
    // moment the queued null result lands.
    const replayable = localFirst;

    // Device offline — queue only mutations on the replay allowlist. Anything
    // else fails fast with a network-shaped error (instant honest toast, no
    // doomed request, and no ghost replay on reconnect).
    if (shouldTreatAsOffline(state)) {
      if (!replayable) {
        logger.info(
          `Queue Link: Offline, rejecting online-only mutation ${operation.operationName}`,
        );
        return new Observable(observer => {
          // A named error so the reachability breaker and network-error
          // telemetry can skip it — this preemptive rejection never touched the
          // network and proves nothing about the API.
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

    // API unreachable while the device is online (reachability circuit breaker
    // open) — queue replay-allowlisted mutations immediately instead of firing a
    // doomed request, matching the offline path. Everything else falls through
    // and fires (and surfaces its error) as before; it isn't safe to auto-replay.
    if (state.apiReachable === false && replayable) {
      logger.info(
        `Queue Link: API unreachable, queuing replayable mutation ${operation.operationName}`,
      );
      return new Observable(observer => {
        enqueueAndComplete(operation, observer, 'api-unreachable');
      });
    }

    // Online — pass through, UNLESS the mutation opts into local-first. Without
    // the opt-in we keep current behavior (so un-migrated mutations and creates
    // are unaffected).
    if (!localFirst) {
      return forward(operation);
    }

    // Local-first online path: forward, but fall back to queuing on a genuine
    // network failure (no result received) so the change replays later instead
    // of erroring out. A GraphQL/validation error (or any result) propagates
    // normally.
    return new Observable(observer => {
      let received = false;
      const subscription = forward(operation).subscribe({
        next: result => {
          received = true;
          observer.next(result);
          // A successful network response proves the API is reachable — drain any
          // queued local-first changes now. Covers the API-down-while-"online"
          // recovery case the offline→online trigger misses (isOnline never
          // flipped). Debounced + no-ops when the queue is empty.
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
 * Enqueue a mutation and complete the observable with a null-field result
 * (marked `queued`) — the UI change comes from the hook's own permanent cache
 * write, made before firing (the house local-first pattern; Apollo's
 * `optimisticResponse` is never used here and never reaches link context).
 * Shared by the offline and online-network-error paths.
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
      convergence: readConvergence(operationContext),
      // The local change this stands for, so a withdrawal after a restart can
      // restore what was there instead of dropping the entity.
      // Always a list, even for the single-entity case: one shape to read at
      // withdrawal time rather than two.
      intents:
        (operationContext.writeIntents as WriteIntent[] | undefined) ??
        (operationContext.writeIntent
          ? [operationContext.writeIntent as WriteIntent]
          : undefined),
      status: QueueStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      requiresAuth: !NEVER_QUEUE_OPERATIONS.includes(operationName),
    };

    try {
      const evicted = queueStore.addMutation(queuedMutation);
      if (evicted) {
        // Making room cost an auth-parked entry its place in the queue. Its
        // local change has been on screen since it was made, waiting for a
        // sign-in that never came — so this is the moment the queue gives up on
        // it, and the person has to be told rather than left trusting it.
        queueManager.withdrawUnqueueableWrite(evicted, {
          type: 'auth',
          message: 'Queued change discarded to make room for newer changes',
          timestamp: Date.now(),
          retryable: false,
        });
      }
    } catch (error) {
      if (!(error instanceof QueueCapacityError)) throw error;
      // The local-first cache write has already landed — that is the whole
      // pattern: write, then fire. With the enqueue refused, the change is on
      // screen and in the persisted cache with nothing that will ever send it.
      // Withdraw it the same way a refused replay is withdrawn, so the user
      // sees it undone rather than trusting a change that will never sync.
      queueManager.withdrawUnqueueableWrite(queuedMutation, {
        type: 'unknown',
        message: 'Offline queue is full — change could not be queued',
        timestamp: Date.now(),
        retryable: false,
      });
      observer.error(error);
      return;
    }

    // Apollo writes a mutation's result into the cache against its selection set.
    // A bare `null`/`{}` result makes InMemoryCache warn "Missing field <field>
    // while writing result {}", so emit each top-level field as `null` instead —
    // a present-but-null field is a valid, quiet write (Apollo doesn't recurse
    // into the unselected subfields). The actual UI change comes from each hook's
    // own optimistic cache write; the `queued` extension marks this as deferred.
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
 * The only context key a replay reads is `localFirst` (marks the entry as an
 * opt-in). Idempotency for granular pantry deltas now rides on
 * `input.idempotencyKey` inside the persisted variables, not on the context, so
 * there's nothing else to carry here. The full Apollo operation context also
 * carries client internals that don't survive persistence — functions are
 * silently dropped by JSON serialization, and a circular value would make the
 * MMKV write throw inside `saveQueue`, silently losing the enqueue. Persist only
 * the fixed, serializable subset.
 */
function pickPersistedContext(context: DefaultContext): DefaultContext {
  const persisted: DefaultContext = {};
  if (context.localFirst !== undefined) {
    persisted.localFirst = context.localFirst;
  }
  return persisted;
}

/**
 * The write's declared convergence, defaulted to the safe direction.
 *
 * `relative` is safe because it never re-sends: a write that does not say its
 * value is absolute is reported to the person rather than replayed against a
 * refreshed version, so a mis-declared delta cannot double-apply. An operation
 * that wants the re-send has to ask for it.
 */
function readConvergence(context: DefaultContext): WriteConvergence {
  return context.convergence === 'absolute' ? 'absolute' : 'relative';
}

/**
 * Build a queued mutation's result `data`: each top-level field set to `null`.
 * See the call site for why a present-but-null field is required (avoids Apollo's
 * "Missing field" cache-write warning). The classifier treats a `null` payload
 * field as "queued" and a non-null non-success payload as "rejected".
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

/**
 * Check if operation is a mutation
 */
function isMutation(operation: { query: DocumentNode }): boolean {
  const definition = getMainDefinition(operation.query);
  return (
    definition.kind === 'OperationDefinition' &&
    definition.operation === 'mutation'
  );
}
