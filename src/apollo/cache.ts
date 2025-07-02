// src/apollo/cache.ts
import {InMemoryCache, NormalizedCacheObject} from '@apollo/client';
import {storage} from '../storage/mmkv';

const CACHE_KEY = 'apollo-cache';

export async function makeCache(): Promise<InMemoryCache> {
  const cache = new InMemoryCache();

  // 1) Try to restore from MMKV
  const saved = storage.getString(CACHE_KEY);
  if (saved) {
    try {
      cache.restore(JSON.parse(saved) as NormalizedCacheObject);
    } catch (err) {
      console.warn(
        'Failed to restore Apollo cache from MMKV, starting fresh:',
        err,
      );
      storage.delete(CACHE_KEY);
    }
  }

  // 2) Helper to persist the full cache
  const persist = () => {
    try {
      const data = cache.extract();
      storage.set(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to persist Apollo cache to MMKV:', err);
    }
  };

  // 3) Monkey-patch writeQuery
  const _writeQuery = cache.writeQuery.bind(cache);
  cache.writeQuery = options => {
    const result = _writeQuery(options);
    persist();
    return result;
  };

  // 4) Monkey-patch writeFragment
  const _writeFragment = cache.writeFragment.bind(cache);
  cache.writeFragment = options => {
    const result = _writeFragment(options);
    persist();
    return result;
  };

  // 5) Monkey-patch evict (for example, on cache.clear or cache.evict calls)
  const _evict = cache.evict.bind(cache);
  cache.evict = options => {
    const result = _evict(options);
    persist();
    return result;
  };

  // 6) Optionally also patch cache.reset / clearAll
  const _reset = cache.reset.bind(cache);
  cache.reset = async () => {
    const result = await _reset();
    storage.delete(CACHE_KEY);
    return result;
  };

  return cache;
}
