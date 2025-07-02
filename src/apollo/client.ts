import {
  ApolloClient,
  InMemoryCache,
  ApolloLink,
  HttpLink,
  NormalizedCacheObject,
} from '@apollo/client';
import {storage} from '../storage/mmkv';
import {link} from './links';

const CACHE_KEY = 'apollo-cache';

// 1) Build & restore cache synchronously
const cache = new InMemoryCache();

const saved = storage.getString(CACHE_KEY);
if (saved) {
  try {
    cache.restore(JSON.parse(saved) as NormalizedCacheObject);
  } catch (err) {
    console.warn('Failed to restore Apollo cache, starting fresh', err);
    storage.delete(CACHE_KEY);
  }
}

// 2) Monkey-patch writes to persist automatically
const persist = () => {
  try {
    const data = cache.extract();
    storage.set(CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to persist Apollo cache', err);
  }
};

const origWriteQuery = cache.writeQuery.bind(cache);
const origWriteFragment = cache.writeFragment.bind(cache);
const origEvict = cache.evict.bind(cache);
const origReset = cache.reset.bind(cache);

cache.writeQuery = opts => {
  const r = origWriteQuery(opts);
  persist();
  return r;
};
cache.writeFragment = opts => {
  const r = origWriteFragment(opts);
  persist();
  return r;
};
cache.evict = opts => {
  const r = origEvict(opts);
  persist();
  return r;
};
cache.reset = async () => {
  const r = await origReset();
  storage.delete(CACHE_KEY);
  return r;
};

// 3) Create the client once
export const client = new ApolloClient({
  link,
  cache,
});
