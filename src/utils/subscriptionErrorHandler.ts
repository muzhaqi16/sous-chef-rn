// Define a simple error interface instead of importing ApolloError
interface SubscriptionError {
  message?: string;
  networkError?: any;
}

interface RetryState {
  count: number;
  lastAttempt: number;
  backoffMs: number;
}

const retryStates = new Map<string, RetryState>();
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

export const handleSubscriptionError = (
  operationName: string,
  error: SubscriptionError,
  onRetry?: () => void,
): boolean => {
  const errorMessage = error.message || '';
  
  // Check if this is a server-side resolver issue
  const isServerResolverError = 
    errorMessage.includes('Subscription field must return Async Iterable') ||
    errorMessage.includes('Socket closed with event 4500');

  if (!isServerResolverError) {
    // For non-resolver errors, don't retry
    console.error(`Subscription ${operationName} failed with non-resolver error:`, error);
    return false;
  }

  // Get or create retry state
  const state = retryStates.get(operationName) || {
    count: 0,
    lastAttempt: 0,
    backoffMs: INITIAL_BACKOFF_MS,
  };

  // Check if we've exceeded max retries
  if (state.count >= MAX_RETRIES) {
    console.warn(`Subscription ${operationName} failed after ${MAX_RETRIES} retries, giving up`);
    retryStates.delete(operationName);
    return false;
  }

  // Check if we're still in backoff period
  const now = Date.now();
  if (now - state.lastAttempt < state.backoffMs) {
    console.log(`Subscription ${operationName} in backoff period, not retrying yet`);
    return false;
  }

  // Increment retry count and update backoff
  state.count += 1;
  state.lastAttempt = now;
  state.backoffMs = Math.min(state.backoffMs * 2, MAX_BACKOFF_MS);
  
  retryStates.set(operationName, state);

  console.log(
    `Retrying subscription ${operationName} (attempt ${state.count}/${MAX_RETRIES}) after ${state.backoffMs}ms`
  );

  // Schedule retry if callback provided
  if (onRetry) {
    setTimeout(() => {
      onRetry();
    }, state.backoffMs);
  }

  return true;
};

export const clearRetryState = (operationName: string): void => {
  retryStates.delete(operationName);
};

export const clearAllRetryStates = (): void => {
  retryStates.clear();
};

// Helper to check if error is a known server issue
export const isKnownServerError = (error: SubscriptionError): boolean => {
  const errorMessage = error.message || '';
  return (
    errorMessage.includes('Subscription field must return Async Iterable') ||
    errorMessage.includes('Socket closed with event 4500') ||
    errorMessage.includes('Server-side resolver returned undefined')
  );
};