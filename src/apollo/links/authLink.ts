import {setContext} from '@apollo/client/link/context';
import {storage} from '../../storage/mmkv';

export const authLink = setContext(async (_, {headers}) => {
  const token = storage.getString('accessToken');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});
