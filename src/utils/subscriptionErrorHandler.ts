import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
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
 * A server end a later attempt can get past: `SUBSCRIPTION_ERROR` (documented
 * retryable), or an internal error tagged `category: "infrastructure"`, as while
 * the API restarts. Any other server error repeats as it is.
 */
export const isRetryableServerEnd = (error: unknown): boolean => {
  const top = getTopLevelGraphQLError(error);
  return (
    top?.code === TopLevelErrorCode.SubscriptionError ||
    (top?.code === TopLevelErrorCode.InternalServerError &&
      top.category === 'infrastructure')
  );
};

/**
 * Narrow, since a permanent rejection disables a stream for the session:
 * `SUBSCRIPTION_LIMIT_EXCEEDED` frees up and `SUBSCRIPTION_ERROR` is retryable.
 */
const PERMANENT_REJECTION_CODES = new Set([
  'BAD_USER_INPUT',
  'GRAPHQL_VALIDATION_FAILED',
  'GRAPHQL_PARSE_FAILED',
  'VALIDATION_FAILED',
  'BAD_REQUEST',
]);

/**
 * The server refused the DOCUMENT (over depth 5 or cost 500) and will every
 * time, so never retry. An armor rejection's code varies, so it is recognised
 * on its own.
 */
export const isPermanentSubscriptionRejection = (
  error: SubscriptionError,
): boolean => {
  if (isArmorRejection(error)) return true;

  const top = getTopLevelGraphQLError(error);
  if (!top) return false;
  return isArmorRejection(top) || PERMANENT_REJECTION_CODES.has(top.code);
};

/**
 * Reports a subscription failure neither transport churn, which recovers on its
 * own, nor a resolver that returned no stream explains. Re-subscribing is
 * `useSubscriptionTransportRecovery`'s.
 */
export const reportSubscriptionError = (
  operationName: string,
  error: SubscriptionError,
): void => {
  if (isNetworkError(error) || isNonIterableSubscriptionResolver(error)) {
    return;
  }
  errorService.reportError(
    new Error(`Subscription ${operationName} failed with non-resolver error`),
    {
      operation: 'subscriptionError',
      subscription: operationName,
      error: serializeError(error),
    },
  );
};
