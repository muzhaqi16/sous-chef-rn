import {setContext} from '@apollo/client/link/context';
import {useStore} from '../../store';

export const authLink = setContext(async (operation, {headers}) => {
  // Skip auth header for refresh token mutation
  if (operation.operationName === 'RefreshToken') {
    return {headers};
  }

  const token = useStore.getState().accessToken;
  if (!token) {
    console.log(
      '[AuthLink] No access token available for operation:',
      operation.operationName,
    );
  }
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});
