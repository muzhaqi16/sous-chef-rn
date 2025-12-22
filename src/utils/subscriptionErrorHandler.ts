import { serializeError } from './errorSerialization';

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
  const errorMessage = (error.message || '').toLowerCase();

  // Check if this is a network-related error that will auto-recover
  const isSocketClosed = errorMessage.includes('socket closed');
  const isNetworkError = errorMessage.includes('network') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('websocket');

  // Socket closed and network errors are expected during transitions - suppress them
  if (isSocketClosed || isNetworkError) {
    return false;
  }

  // Check if this is a server-side resolver issue
  const isServerResolverError =
    errorMessage.includes('subscription field must return async iterable');

  if (!isServerResolverError) {
    // For non-resolver errors, don't retry
    console.error(`Subscription ${operationName} failed with non-resolver error:`, serializeError(error));
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
    retryStates.delete(operationName);
    return false;
  }

  // Check if we're still in backoff period
  const now = Date.now();
  if (now - state.lastAttempt < state.backoffMs) {
    return false;
  }

  // Increment retry count and update backoff
  state.count += 1;
  state.lastAttempt = now;
  state.backoffMs = Math.min(state.backoffMs * 2, MAX_BACKOFF_MS);

  retryStates.set(operationName, state);

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
    errorMessage.includes('Server-side resolver returned undefined')
  );
};