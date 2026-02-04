import { SetContextLink } from '@apollo/client/link/context';
import { jwtDecode } from 'jwt-decode';
import { useStore } from '#store';
import Config from 'react-native-config';
import { LogoutCleanup } from '../logoutCleanup';
import { getDeviceIdSync } from '#/utils/deviceId';
import { proactiveTokenRefresh } from './refreshToken';

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

/**
 * Check if refresh token is already expired
 */
const isRefreshTokenExpired = (refreshToken: string): boolean => {
  try {
    const decoded = jwtDecode<{ exp: number }>(refreshToken);
    return Date.now() > decoded.exp * 1000;
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
  const apiKey = Config.API_KEY;

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
  const refreshToken = useStore.getState().refreshToken;

  // Pre-request token validation: check if token is expiring soon
  if (token && isTokenExpiringSoon(token, REFRESH_BUFFER_MS)) {
    // Check if refresh token is also expired
    if (refreshToken && isRefreshTokenExpired(refreshToken)) {
      // Both tokens expired - trigger logout
      console.warn('[AuthLink] Both tokens expired, redirecting to login');
      useStore.getState().tokenRefreshFailed(true);
      throw new Error('Session expired - please log in again');
    }

    // Attempt proactive refresh before the request
    console.log('[AuthLink] Token expiring soon, refreshing before request');
    const newToken = await proactiveTokenRefresh();
    if (newToken) {
      token = newToken;
    }
    // If refresh fails, use existing token - reactive refresh will handle 401
  }

  if (!token) {
    console.log(
      '[AuthLink] No access token available for operation:',
      operation.operationName,
      'isPublic:',
      operation.operationName && publicOperations.includes(operation.operationName)
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
