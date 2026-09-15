import { socketCloseOf } from './errors/libraryErrorMessages';
import { TimeoutError } from './errors/timeoutError';
import { NetworkRequestError } from './errors/networkRequestError';

/**
 * A request that never got an answer: the HTTP link's fetch rethrows a failed
 * request as `NetworkRequestError`, our own deadlines throw `TimeoutError`, and
 * `GraphQLWsLink` reports a socket close. An `AbortError` is a cancellation.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof NetworkRequestError || error instanceof TimeoutError) {
    return true;
  }
  return error instanceof Error && socketCloseOf(error) !== null;
}
