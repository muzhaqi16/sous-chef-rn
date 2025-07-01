import {setContext} from '@apollo/client/link/context';
import {useStore} from '../../store/useStore';

export const authLink = setContext(async (_, {headers}) => {
  const token = useStore.getState().accessToken;
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});
