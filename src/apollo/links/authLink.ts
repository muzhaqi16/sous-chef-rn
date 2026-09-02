import { SetContextLink } from '@apollo/client/link/context';
import { useStore } from '#store';
import { env } from '#/config/env';
import { LogoutCleanup } from '../logoutCleanup';
import { getDeviceIdSync } from '#/utils/deviceId';
import { isTokenExpired, isTokenExpiringSoon } from '#/utils/tokenExpiry';
import { proactiveTokenRefresh } from './refreshToken';
import { logger } from '#/utils/environment';

// Pre-request token validation buffer (5 minutes before expiry)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** ~40s worst case unbounded (3 retries x 10s abort); past this, send anyway. */
const AWAITED_REFRESH_CEILING_MS = 12_000;

/** The refresh, or null if it outruns the ceiling. Never rejects. */
const refreshWithinCeiling = async (): Promise<string | null> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ceiling = new Promise<null>(resolve => {
    timer = setTimeout(() => resolve(null), AWAITED_REFRESH_CEILING_MS);
  });

  let winner: string | null = null;
  try {
    winner = await Promise.race([proactiveTokenRefresh(), ceiling]);
  } catch (error) {
    logger.warn('[AuthLink] Awaited refresh rejected:', error);
  }
  clearTimeout(timer);
  return winner;
};

// `allowDuringLogout` is set by a call that belongs to the sign-out itself: it
// dispatches before `isLoggingOut` is set and resolves after, so without the
// opt-in the logout cancels its own cleanup.
export const authLink = new SetContextLink(
  async ({ headers, allowDuringLogout }, operation) => {
    // Skip operations during logout to prevent unnecessary auth errors
    if (
      !allowDuringLogout &&
      LogoutCleanup.shouldSkipOperation(operation.operationName)
    ) {
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
    let token = useStore.getState().accessToken;

    // A sign-out call takes whatever token is still stored. Rotating here would
    // write a fresh pair back into the store and Keychain moments after
    // `resetStore` cleared them, re-arming the session being ended.
    if (allowDuringLogout) {
      return {
        headers: {
          ...headers,
          ...(apiKey && { 'x-api-key': apiKey }),
          ...(token && { authorization: `Bearer ${token}` }),
          ...(deviceId && { 'x-device-id': deviceId }),
        },
      };
    }

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
      } else if (isTokenExpired(token)) {
        // This token cannot authenticate anything, so sending it costs a
        // guaranteed 401. Awaiting the SINGLE-FLIGHT refresh is what stops N
        // concurrent operations each presenting the same dead JWT and each
        // drawing its own rotation. A failure resolves null: fall through on the
        // old token and let the reactive 401 path decide, as before.
        token = (await refreshWithinCeiling()) ?? token;
      } else {
        // Still valid, so nothing needs the refresh to finish — fire-and-forget
        // rather than stalling every concurrent request behind one shared retry
        // loop. If it fails, the reactive 401 path is the fallback.
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
  },
);
