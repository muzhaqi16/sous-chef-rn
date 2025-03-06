import {ApolloClient, InMemoryCache} from '@apollo/client';
import {loadErrorMessages, loadDevMessages} from '@apollo/client/dev';
import {link} from './links';

// Optionally load Apollo Client dev messages in development mode
if (__DEV__) {
  loadDevMessages();
  loadErrorMessages();
}
// Create Apollo Client instance
export const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});
