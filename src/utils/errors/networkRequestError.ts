/**
 * `fetch` rejected before any response: whatwg-fetch reports a failed or
 * timed-out request as a `TypeError`. Converted at the fetch call so a
 * `TypeError` from a bug anywhere else is never read as the network.
 */
export class NetworkRequestError extends Error {
  override readonly name = 'NetworkRequestError';
}
