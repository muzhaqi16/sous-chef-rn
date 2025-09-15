import {ApolloLink} from '@apollo/client';
import {client} from '../client';
import {storage} from '../../storage/mmkv';

export const persistLink = new ApolloLink((operation, forward) => {
  return forward(operation).map(response => {
    // Serialize entire cache to MMKV
    const data = client.cache.extract();
    storage.set('apollo-cache', JSON.stringify(data));
    return response;
  });
});
