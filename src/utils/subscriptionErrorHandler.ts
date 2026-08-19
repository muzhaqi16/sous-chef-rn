import { errorService } from '#/services/errorService';
import { serializeError } from './errorSerialization';
import { getTopLevelGraphQLError } from './errors/graphqlErrors';

// Define a simple error interface instead of importing ApolloError
interface SubscriptionError {
  message?: string;
  networkError?: { message?: string } | null;
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

/**
 * True for socket-closed / network-transition errors that auto-recover (app
 * backgrounding, network change, WebSocket churn). These are expected churn,
 * not failures — callers downgrade them to warn/debug rather than error.
 */
export const isExpectedNetworkTransitionError = (message?: string): boolean => {
  const m = (message || '').toLowerCase();
  return (
    m.includes('socket closed') ||
    m.includes('network') ||
    m.includes('connection') ||
    m.includes('websocket')
  );
};

/**
 * Codes that mean "this document will never be accepted".
 *
 * Narrow on purpose — a permanent rejection disables a stream for the session.
 * The two adjacent-looking subscription codes are excluded deliberately:
 * `SUBSCRIPTION_LIMIT_EXCEEDED` is a capacity condition that frees up, and
 * `SUBSCRIPTION_ERROR` is documented retryable.
 */
const PERMANENT_REJECTION_CODES = new Set([
  'BAD_USER_INPUT',
  'GRAPHQL_VALIDATION_FAILED',
  'GRAPHQL_PARSE_FAILED',
  'VALIDATION_FAILED',
  'BAD_REQUEST',
]);

/**
 * The rejection graphql-armor produces: "Syntax Error: Query depth limit of 5
 * exceeded, found 8." — worded as a syntax error, but the document parsed fine
 * and `found N` is its computed depth. Matched on the message as well as the
 * code, since the code an armor rejection maps to varies.
 */
const ARMOR_REJECTION =
  /(depth|cost) limit of \d+ exceeded|query validation error/i;

/**
 * True when the server refused the DOCUMENT, not the request. Subscriptions are
 * validated against depth 5 / cost 500, and a document over that is refused
 * identically every time — "fix the document", never "retry".
 */
export const isPermanentSubscriptionRejection = (
  error: SubscriptionError,
): boolean => {
  const message = error?.message ?? '';
  if (ARMOR_REJECTION.test(message)) return true;

  const top = getTopLevelGraphQLError(error);
  if (top) {
    if (ARMOR_REJECTION.test(top.message)) return true;
    return PERMANENT_REJECTION_CODES.has(top.code);
  }
  return false;
};

export const handleSubscriptionError = (
  operationName: string,
  error: SubscriptionError,
  onRetry?: () => void,
): boolean => {
  const errorMessage = (error.message || '').toLowerCase();

  // Socket closed and network errors are expected during transitions - suppress them
  if (isExpectedNetworkTransitionError(error.message)) {
    return false;
  }

  // Check if this is a server-side resolver issue
  const isServerResolverError = errorMessage.includes(
    'subscription field must return async iterable',
  );

  if (!isServerResolverError) {
    // For non-resolver errors, don't retry. Socket/network errors already
    // returned above, so anything reaching here is an unexpected failure worth
    // reporting to telemetry.
    errorService.reportError(
      new Error(`Subscription ${operationName} failed with non-resolver error`),
      {
        operation: 'subscriptionError',
        subscription: operationName,
        error: serializeError(error),
      },
    );
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
