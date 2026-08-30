import { SetContextLink } from '@apollo/client/link/context';
import { useStore } from '#store';
import { env } from '#/config/env';
import { LogoutCleanup } from '../logoutCleanup';
import { getDeviceIdSync } from '#/utils/deviceId';
import { isTokenExpiringSoon } from '#/utils/tokenExpiry';
import { proactiveTokenRefresh } from './refreshToken';
import { logger } from '#/utils/environment';

// Pre-request token validation buffer (5 minutes before expiry)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

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

  // Refresh ahead of the request when the access token is near expiry. Never
  // decide LOCALLY that a session is dead — a clock-skew guess misfires, and an
  // API outage still reports `isOnline`. Only refreshToken.ts confirms it,
  // server-side, and it preserves the cache on a network failure.
  if (token && isTokenExpiringSoon(token, REFRESH_BUFFER_MS)) {
    if (!useStore.getState().isOnline) {
      // Offline: skip the refresh attempt (it would only retry-and-fail, adding
      // latency to every request). Defer — the request hits cache or fails at
      // the network layer, and we re-auth when back online.
      useStore.getState().setNeedsTokenRefresh(true);
    } else {
      // Fire-and-forget — do NOT await. The token is still valid, so nothing
      // needs the refresh to finish, and awaiting stalls EVERY concurrent
      // request behind one shared retry loop (dedupe means they all queue on
      // it). If it fails, the reactive 401 path is the fallback.
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
