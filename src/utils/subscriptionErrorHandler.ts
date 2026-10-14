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
 * The SERVER ended the subscription with a fault a later attempt can get past:
 * `SUBSCRIPTION_ERROR`, which the schema documents as retryable, or an internal
 * error the API tags `category: "infrastructure"` (a database or pool it could
 * not reach, as while it restarts). Any other server error repeats as it is.
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

/**
 * Reports a subscription failure neither transport churn, which recovers on its
 * own, nor a resolver that returned no stream explains. Re-subscribing is
 * `useSubscriptionTransportRecovery`'s.
 */
export const reportSubscriptionError = (
  operationName: string,
  error: SubscriptionError,
): void => {
  if (
    isExpectedTransportError(error) ||
    isNonIterableSubscriptionResolver(error)
  ) {
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

/** A subscription resolver that returned no event stream. */
export const isKnownServerError = (error: SubscriptionError): boolean =>
  isNonIterableSubscriptionResolver(error);
