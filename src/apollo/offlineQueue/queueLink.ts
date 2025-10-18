import { ApolloLink, Observable, Operation, FetchResult } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { v4 as uuid } from 'uuid';
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
 * - Offline: Queue mutations and return optimistic response
 * - Auth-aware: Associates mutations with current user
 * - Idempotent: Prevents re-queuing of mutations being replayed
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

        // Create queued mutation
        const operationName = operation.operationName || 'UnknownMutation';
        const queuedMutation: QueuedMutation = {
          id: uuid(),
          userId: user.id,
          operationName: operationName,
          mutation: operation.query,
          variables: operation.variables,
          optimisticResponse: getOptimisticResponse(operation),
          context: operation.getContext(),
          status: QueueStatus.PENDING,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          requiresAuth: !NEVER_QUEUE_OPERATIONS.includes(operationName),
        };

        // Add to queue
        queueStore.addMutation(queuedMutation);

        // Return optimistic response immediately
        const optimisticResult = queuedMutation.optimisticResponse;
        if (optimisticResult) {
          observer.next({ data: optimisticResult });
          observer.complete();
        } else {
          // If no optimistic response, return minimal success
          const result: Record<string, any> = {
            __typename: 'Mutation',
          };
          if (operationName) {
            result[operationName] = true;
          }
          observer.next({ data: result });
          observer.complete();
        }
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

/**
 * Extract optimistic response from operation context
 */
function getOptimisticResponse(operation: Operation): any {
  // Check if optimistic response was provided in mutation options
  const context = operation.getContext();
  if (context.optimisticResponse) {
    return typeof context.optimisticResponse === 'function'
      ? context.optimisticResponse(operation.variables)
      : context.optimisticResponse;
  }

  // No optimistic response provided
  return null;
}
