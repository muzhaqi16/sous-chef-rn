import { ServerError } from '@apollo/client/errors';

const GATEWAY_STATUSES: readonly number[] = [502, 503, 504];

/**
 * The server, or a gateway in front of it, answered with a fault. Apart from
 * `isNetworkError`, whose callers mean no answer came: this one may have
 * applied, so only a write safe to repeat queues on it.
 */
export const isServerFault = (error: unknown): boolean =>
  ServerError.is(error) && error.statusCode >= 500;

/** A fault saying the API is not there, where a 500 says one request broke. */
export const isGatewayFault = (error: unknown): boolean =>
  ServerError.is(error) && GATEWAY_STATUSES.includes(error.statusCode);
