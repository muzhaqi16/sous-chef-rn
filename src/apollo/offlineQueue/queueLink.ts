import { ApolloLink, Observable, Operation, FetchResult } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { generateId } from '#/utils/generateId';
import { useStore } from '#store';
import { queueStore } from './queueStore';
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
 * Queue Link - Intercepts mutations and queues them when offline
 *
 * Behavior:
 * - Online: Pass through mutations normally
 * - Offline: Queue mutations and complete without returning data
 * - Auth-aware: Associates mutations with current user
 * - Idempotent: Prevents re-queuing of mutations being replayed
 *
 * Offline Strategy:
 * Mutations are queued when offline and completed immediately without observer.next().
 * Optimistic responses (configured in each mutation hook) provide immediate UI feedback.
 * When back online, the queue replays and real server responses update the cache.
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
    if (operation.operationName && NEVER_QUEUE_OPERATIONS.includes(operation.operationName)) {
      return forward(operation);
    }

    const state = useStore.getState();

    // If online, pass through normally
    if (state.isOnline) {
      return forward(operation);
    }

    // Offline - queue the mutation
    console.log(`📴 Queue Link: Offline, queuing mutation ${operation.operationName}`);

    return new Observable<FetchResult>((observer) => {
      try {
        // Get current user
        const user = state.user;
        if (!user) {
          observer.error(new Error('Cannot queue mutation: No authenticated user'));
          return;
        }

        // Get optimistic response from operation context
        const operationContext = operation.getContext();
        const optimisticResponse = operationContext.optimisticResponse;

        // Create queued mutation
        const operationName = operation.operationName || 'UnknownMutation';
        const queuedMutation: QueuedMutation = {
          id: generateId(),
          userId: user.id,
          operationName: operationName,
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

        // Add to queue
        queueStore.addMutation(queuedMutation);

        // Return optimistic response if available, otherwise null
        // This ensures cache updaters receive the optimistic data and can update the cache
        // The 'queued' extension marker allows components to show pending UI states
        observer.next({
          data: optimisticResponse ?? null,
          errors: undefined,
          extensions: { queued: true },
        });
        observer.complete();

        console.log(
          `✅ Queue Link: Queued ${operationName}, ${optimisticResponse ? 'with optimistic response' : 'without optimistic response'}`
        );
      } catch (error) {
        observer.error(error);
      }
    });
  });
};

/**
 * Check if operation is a mutation
 */
function isMutation(operation: Operation): boolean {
  const definition = getMainDefinition(operation.query);
  return (
    definition.kind === 'OperationDefinition' &&
    definition.operation === 'mutation'
  );
}
