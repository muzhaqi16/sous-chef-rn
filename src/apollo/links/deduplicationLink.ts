import { ApolloLink, Observable, FetchResult } from '@apollo/client';

interface PendingRequest {
  observable: Observable<FetchResult>;
  subscribers: Array<{
    next?: (value: FetchResult) => void;
    error?: (error: any) => void;
    complete?: () => void;
  }>;
}

/**
 * Deduplication link that prevents identical queries from being sent simultaneously
 * Improves performance by sharing results between identical requests
 */
export const deduplicationLink = new ApolloLink((operation, forward) => {
  // Create a unique key for this operation
  const operationKey = createOperationKey(operation);

  // Check if we already have a pending request for this operation
  if (pendingRequests.has(operationKey)) {
    const pending = pendingRequests.get(operationKey)!;

    // Return a new observable that shares the existing request
    return new Observable<FetchResult>(observer => {
      // Add this observer to the list of subscribers
      pending.subscribers.push({
        next: observer.next.bind(observer),
        error: observer.error.bind(observer),
        complete: observer.complete.bind(observer),
      });

      // Return cleanup function
      return () => {
        const index = pending.subscribers.findIndex(sub =>
          sub.next === observer.next.bind(observer)
        );
        if (index > -1) {
          pending.subscribers.splice(index, 1);
        }
      };
    });
  }

  // Create new observable for this operation
  const observable = forward(operation);

  // Store it as pending
  const pending: PendingRequest = {
    observable,
    subscribers: [],
  };
  pendingRequests.set(operationKey, pending);

  return new Observable<FetchResult>(observer => {
    // Subscribe to the actual request
    const subscription = observable.subscribe({
      next: (result) => {
        // Notify the original observer
        observer.next(result);

        // Notify all other subscribers
        pending.subscribers.forEach(sub => {
          if (sub.next) sub.next(result);
        });
      },
      error: (error) => {
        // Clean up
        pendingRequests.delete(operationKey);

        // Notify the original observer
        observer.error(error);

        // Notify all other subscribers
        pending.subscribers.forEach(sub => {
          if (sub.error) sub.error(error);
        });
      },
      complete: () => {
        // Clean up
        pendingRequests.delete(operationKey);

        // Notify the original observer
        observer.complete();

        // Notify all other subscribers
        pending.subscribers.forEach(sub => {
          if (sub.complete) sub.complete();
        });
      },
    });

    // Return cleanup function
    return () => {
      subscription.unsubscribe();
      pendingRequests.delete(operationKey);
    };
  });
});

// Map to store pending requests
const pendingRequests = new Map<string, PendingRequest>();

/**
 * Create a unique key for an operation based on query and variables
 */
function createOperationKey(operation: any): string {
  const { query, variables, operationName } = operation;

  // For mutations, always allow them through (don't deduplicate)
  if (operation.query.definitions.some((def: any) =>
    def.kind === 'OperationDefinition' && def.operation === 'mutation'
  )) {
    return `mutation_${Date.now()}_${Math.random()}`;
  }

  // For subscriptions, allow them through (don't deduplicate)
  if (operation.query.definitions.some((def: any) =>
    def.kind === 'OperationDefinition' && def.operation === 'subscription'
  )) {
    return `subscription_${Date.now()}_${Math.random()}`;
  }

  // For queries, create a key based on operation name and variables
  const queryString = query.loc?.source?.body || '';
  const variablesString = JSON.stringify(variables || {});

  return `query_${operationName}_${hashString(queryString + variablesString)}`;
}

/**
 * Simple hash function for creating operation keys
 */
function hashString(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString();

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString();
}