import { SetContextLink } from '@apollo/client/link/context';
import { useStore } from '#store';
import Config from 'react-native-config';
import { LogoutCleanup } from '../logoutCleanup';
import { getDeviceIdSync } from '#/utils/deviceId';

export const authLink = new SetContextLink(async ({ headers }, operation) => {
  // Skip operations during logout to prevent unnecessary auth errors
  if (LogoutCleanup.shouldSkipOperation(operation.operationName)) {
    throw new Error('Operation cancelled due to logout process');
  }

  // Always include the API key for all requests
  const apiKey = Config.API_KEY;

  // Get the access token for authentication (if available)
  const token = useStore.getState().accessToken;

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
