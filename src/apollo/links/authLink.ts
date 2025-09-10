import {setContext} from '@apollo/client/link/context';
import {useStore} from '../../store';

export const authLink = setContext(async (operation, {headers}) => {
  // Always include the API key for all requests
  const apiKey = process.env.API_KEY;


  // Get the access token for authentication (if available)
  const token = useStore.getState().accessToken;

  // Operations that don't need authentication
  const publicOperations = ['RefreshToken', 'Login', 'Register', 'SignUp'];

  // Skip auth header for refresh token mutation but keep API key
  if (
    operation.operationName &&
    publicOperations.includes(operation.operationName)
  ) {
    return {
      headers: {
        ...headers,
        ...(apiKey && {'x-api-key': apiKey}),
      },
    };
  }

  if (!token) {
    console.log(
      '[AuthLink] No access token available for operation:',
      operation.operationName,
    );
  }

  return {
    headers: {
      ...headers,
      // Always include API key
      ...(apiKey && {'x-api-key': apiKey}),
      // Include authorization header only when token is available
      ...(token && {authorization: `Bearer ${token}`}),
    },
  };
});
