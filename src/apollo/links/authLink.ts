import { SetContextLink } from '@apollo/client/link/context';
import { jwtDecode } from 'jwt-decode';
import { useStore } from '#store';
import { env } from '#/config/env';
import { LogoutCleanup } from '../logoutCleanup';
import { getDeviceIdSync } from '#/utils/deviceId';
import { proactiveTokenRefresh } from './refreshToken';
import { logger } from '#/utils/environment';

// Pre-request token validation buffer (5 minutes before expiry)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Check if token is expiring within the buffer window
 */
const isTokenExpiringSoon = (token: string, bufferMs: number): boolean => {
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    const expiresAt = decoded.exp * 1000;
    return Date.now() > expiresAt - bufferMs;
  } catch {
    return true; // Invalid token, treat as expired
  }
};

export const authLink = new SetContextLink(async ({ headers }, operation) => {
  // Skip operations during logout to prevent unnecessary auth errors
  if (LogoutCleanup.shouldSkipOperation(operation.operationName)) {
    throw new Error('Operation cancelled due to logout process');
  }

  // Always include the API key for all requests
  const apiKey = env.API_KEY;

  // Get device ID for subscription self-echo filtering
  // Server includes this in subscription payloads as originatorClientId
  const deviceId = getDeviceIdSync();

  // Operations that don't need authentication
  const publicOperations = ['RefreshToken', 'Login', 'Register', 'SignUp'];

  // Skip auth header for public operations but keep API key
  if (
    operation.operationName &&
    publicOperations.includes(operation.operationName)
  ) {
    return {
      headers: {
        ...headers,
        ...(apiKey && { 'x-api-key': apiKey }),
        ...(deviceId && { 'x-device-id': deviceId }),
      },
    };
  }

  // Get the access token for authentication (if available)
  const token = useStore.getState().accessToken;

  // Pre-request token validation: if the access token is expiring/expired, try
  // a server refresh before sending the request. We deliberately do NOT decide
  // locally that the session is dead (e.g. by checking the refresh token's exp
  // and wiping the cache) — a local-clock guess misfires on clock skew, and
  // during an API outage the device still reports `isOnline` even though the
  // server is unreachable. The session's fate is confirmed server-side in
  // refreshToken.ts, which preserves the cache on a network failure and only
  // triggers a cache-clearing logout on a genuine 401 / UNAUTHENTICATED.
  if (token && isTokenExpiringSoon(token, REFRESH_BUFFER_MS)) {
    if (!useStore.getState().isOnline) {
      // Offline: skip the refresh attempt (it would only retry-and-fail, adding
      // latency to every request). Defer — the request hits cache or fails at
      // the network layer, and we re-auth when back online.
      useStore.getState().setNeedsTokenRefresh(true);
    } else {
      // Fire-and-forget — do NOT await. The token is still valid for another
      // REFRESH_BUFFER_MS (only approaching expiry, not expired), so there is
      // no correctness reason to block this request on a refresh completing.
      // Awaiting here used to stall every request whose token entered this
      // window behind performTokenRefresh()'s own retry loop (up to 3 attempts
      // with exponential backoff on network failure) — on a slow connection
      // that is tens of seconds, and since proactiveTokenRefresh() dedupes
      // concurrent callers onto one shared promise, EVERY concurrent request
      // (e.g. a screen's paired queries firing together) piled up behind that
      // single slow refresh, freezing the whole app for its entire duration.
      // Firing it without awaiting keeps the safety-net behavior (this is the
      // fallback for tokenScheduler.ts's own 10-minutes-ahead background
      // refresh missing its window) without blocking anything on it; if it
      // fails, the reactive 401 path (errorLink → refreshToken) is the
      // documented fallback.
      void proactiveTokenRefresh();
    }
  }

  if (!token) {
    logger.debug(
      '[AuthLink] No access token available for operation:',
      operation.operationName,
      'isPublic:',
      operation.operationName &&
        publicOperations.includes(operation.operationName),
    );
  }

  return {
    headers: {
      ...headers,
      // Always include API key
      ...(apiKey && { 'x-api-key': apiKey }),
      // Include authorization header only when token is available
      ...(token && { authorization: `Bearer ${token}` }),
      // Include device ID for subscription self-echo filtering
      ...(deviceId && { 'x-device-id': deviceId }),
    },
  };
});
