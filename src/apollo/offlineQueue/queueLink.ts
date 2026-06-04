import { ApolloLink, Observable } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import type { DocumentNode } from 'graphql';
import { generateId } from '#/utils/generateId';
import { logger } from '#/utils/environment';
import { isNetworkError } from '#/utils/isNetworkError';
import { useStore } from '#store';
import { queueStore } from './queueStore';
import { queueManager } from './queueManager';
import { QueuedMutation, QueueStatus } from './types';

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
 *   hitting the network. Each mutation hook has already written its change to the
 *   cache, so the UI reflects it; the queue replays when back online.
 * - **Online but the request fails with a NETWORK error** (API unreachable while
 *   the device still reports "online" — API down, timeout, captive portal): queue
 *   the mutation for replay instead of surfacing the error — but ONLY when the
 *   mutation opts in via `context.localFirst`. Un-migrated mutations keep their
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

    // Offline — queue immediately.
    if (!state.isOnline) {
      logger.info(
        `Queue Link: Offline, queuing mutation ${operation.operationName}`,
      );
      return new Observable(observer => {
        enqueueAndComplete(operation, observer, 'offline');
      });
    }

    // Online — pass through, UNLESS the mutation opts into local-first. Without
    // the opt-in we keep current behavior (so un-migrated mutations and creates
    // are unaffected).
    if (!operation.getContext().localFirst) {
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
            enqueueAndComplete(operation, observer, 'online-network-error');
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
 * Enqueue a mutation and complete the observable with its optimistic response
 * (marked `queued`) so cache updaters apply and the UI shows immediate feedback.
 * Shared by the offline and online-network-error paths.
 */
function enqueueAndComplete(
  operation: ApolloLink.Operation,
  observer: {
    next: (value: ApolloLink.Result) => void;
    error: (error: unknown) => void;
    complete: () => void;
  },
  reason: 'offline' | 'online-network-error',
): void {
  try {
    const { user } = useStore.getState();
    if (!user) {
      observer.error(new Error('Cannot queue mutation: No authenticated user'));
      return;
    }

    const operationContext = operation.getContext();
    const optimisticResponse = operationContext.optimisticResponse;
    const operationName = operation.operationName || 'UnknownMutation';

    const queuedMutation: QueuedMutation = {
      id: generateId(),
      userId: user.id,
      operationName,
      mutation: operation.query,
      variables: operation.variables,
      optimisticResponse: optimisticResponse || null,
      context: operationContext,
      status: QueueStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      requiresAuth: !NEVER_QUEUE_OPERATIONS.includes(operationName),
    };

    queueStore.addMutation(queuedMutation);

    // Return the optimistic response (or null) so cache updaters receive it; the
    // `queued` marker lets components show pending UI.
    observer.next({
      data: optimisticResponse ?? null,
      errors: undefined,
      extensions: { queued: true },
    });
    observer.complete();

    logger.info(
      `Queue Link: Queued ${operationName} (${reason}), ${
        optimisticResponse
          ? 'with optimistic response'
          : 'without optimistic response'
      }`,
    );
  } catch (error) {
    observer.error(error);
  }
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
