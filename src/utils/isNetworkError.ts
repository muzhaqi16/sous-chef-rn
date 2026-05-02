/**
 * Shared network error detection utility.
 *
 * Previously duplicated across errorLink.ts, refreshToken.ts,
 * and shopping list mutation utils.
 */

const NETWORK_ERROR_PATTERNS = [
  'network request failed',
  'network error',
  'connection refused',
  'timeout',
  'enotfound',
  'econnrefused',
  'econnreset',
  'ehostunreach',
  'socket closed',
  'websocket',
  'fetch failed',
  'ws connection',
  'connection lost',
  'no connection',
  'unreachable',
  'unable to reach',
  'no internet',
  'offline',
];

export function isNetworkError(error: any): boolean {
  const message = (
    error?.message ||
    error?.networkError?.message ||
    ''
  ).toLowerCase();
  return (
    NETWORK_ERROR_PATTERNS.some(p => message.includes(p)) ||
    !!error?.networkError
  );
}
