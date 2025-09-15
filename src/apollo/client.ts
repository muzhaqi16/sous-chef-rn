import {ApolloClient} from '@apollo/client';
import {link} from './links';
import {makeCache} from './cache';
import {loadErrorMessages, loadDevMessages} from '@apollo/client/dev';

if (__DEV__) {
  loadDevMessages();
  loadErrorMessages();
}

const cache = makeCache();

export const client = new ApolloClient({
  link,
  cache,
});

