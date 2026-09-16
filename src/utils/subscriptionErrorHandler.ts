import { errorService } from '#/services/errorService';
import { serializeError } from './errorSerialization';
import { getTopLevelGraphQLError } from './errors/graphqlErrors';
import {
  isArmorRejection,
  isNonIterableSubscriptionResolver,
  socketCloseOf,
} from './errors/libraryErrorMessages';
import { isNetworkError } from './isNetworkError';
import { isRetryableWebSocketClose } from '#/apollo/links/wsCloseCodes';

interface SubscriptionError {
  message?: string;
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
 * True for a transport failure that auto-recovers (app backgrounding, network
 * change, WebSocket churn). Callers downgrade it to warn/debug; it picks a LOG
 * LEVEL, never whether to re-subscribe.
 */
export const isExpectedTransportError = (error: unknown): boolean =>
  isNetworkError(error);

/**
 * Did the transport end this subscription, and can re-subscribing work? The
 * verdict comes from {@link isRetryableWebSocketClose}, the table the socket
 * itself reads, so a code that latched reconnection off is never restarted.
 */
export const classifyTransportTermination = (
  error: SubscriptionError,
): { code?: number } | null => {
  const close = socketCloseOf(error);
  // No code: a connection-level failure (DNS, TCP, an error event). Transient.
  if (!close || close.code === undefined) return close;

  return isRetryableWebSocketClose({ code: close.code, reason: '' })
    ? close
    : null;
};

/**
 * Codes meaning "this document will never be accepted". Narrow on purpose, since
 * a permanent rejection disables a stream for the session:
 * `SUBSCRIPTION_LIMIT_EXCEEDED` frees up and `SUBSCRIPTION_ERROR` is documented
 * retryable, so neither belongs here.
 */
const PERMANENT_REJECTION_CODES = new Set([
  'BAD_USER_INPUT',
  'GRAPHQL_VALIDATION_FAILED',
  'GRAPHQL_PARSE_FAILED',
  'VALIDATION_FAILED',
  'BAD_REQUEST',
]);

/**
 * True when the server refused the DOCUMENT, not the request. Subscriptions are
 * validated against depth 5 / cost 500, and a document over that is refused
 * identically every time — "fix the document", never "retry". The code an
 * armor rejection maps to varies, so it is recognised on its own as well.
 */
export const isPermanentSubscriptionRejection = (
  error: SubscriptionError,
): boolean => {
  if (isArmorRejection(error)) return true;

  const top = getTopLevelGraphQLError(error);
  if (!top) return false;
  return isArmorRejection(top) || PERMANENT_REJECTION_CODES.has(top.code);
};

export const handleSubscriptionError = (
  operationName: string,
  error: SubscriptionError,
  onRetry?: () => void,
): boolean => {
  // Transport churn recovers on its own.
  if (isExpectedTransportError(error)) {
    return false;
  }

  if (!isNonIterableSubscriptionResolver(error)) {
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
  const state = retryStates.get(operationName) ?? {
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

/** A subscription resolver that returned no event stream. */
export const isKnownServerError = (error: SubscriptionError): boolean =>
  isNonIterableSubscriptionResolver(error);
