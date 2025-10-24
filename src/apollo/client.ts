import { ApolloClient } from '@apollo/client';
import { createLink } from './links';
import { makeCache } from './cache';
import { apolloCachePersistence } from './offline/ApolloCachePersistence';
// import {loadErrorMessages, loadDevMessages} from '@apollo/client/dev';

// if (__DEV__) {
//   loadDevMessages();
//   loadErrorMessages();
// }

/**
 * Initialize Apollo Client with persisted cache
 *
 * This function:
 * 1. Creates a new cache instance
 * 2. Loads persisted cache from MMKV (if exists)
 * 3. Restores persisted data to cache
 * 4. Creates Apollo Client with restored cache
 * 5. Sets up cache persistence listeners
 *
 * @returns Initialized Apollo Client with restored cache
 */
function initializeClient() {
  // Create cache instance
  const cache = makeCache();

  // Load persisted cache from MMKV
  const persistedCache = apolloCachePersistence.load();
  if (persistedCache) {
    // Restore persisted data to cache
    cache.restore(persistedCache);
    console.log('📦 Apollo: Cache restored from storage');
  } else {
    console.log('📦 Apollo: No persisted cache, starting fresh');
  }

  // Create link chain (no cache persistence in links - that's handled below)
  const link = createLink(cache);

  // Create Apollo Client
  const client = new ApolloClient({
    link,
    cache,
    // Optimized default fetch policies for performance and offline support
    defaultOptions: {
      query: {
        fetchPolicy: 'cache-first',
        errorPolicy: 'all',
      },
      mutate: {
        errorPolicy: 'all',
      },
      watchQuery: {
        // Changed from 'cache-and-network' to 'cache-first' to prevent unnecessary
        // refetches when cache is already updated by mutations. Queries that need
        // fresh data can explicitly override with fetchPolicy: 'cache-and-network'
        fetchPolicy: 'cache-first',
        errorPolicy: 'ignore',
      },
    },
    // Enable query deduplication for performance
    queryDeduplication: true,
    // Optimize cache operations
    assumeImmutableResults: true,
  });

  // Set up cache persistence using Apollo's lifecycle hooks
  // This is the RIGHT way to persist - let Apollo tell us when cache changes
  setupCachePersistence(client);

  return client;
}

/**
 * Set up automatic cache persistence by wrapping cache methods
 *
 * This is the CORRECT approach (copied from apollo3-cache-persist):
 * - Wrap cache.write, cache.evict, cache.modify, cache.gc
 * - Persist AFTER each cache operation completes
 * - Doesn't interfere with Apollo's observable chain
 * - React hooks observe cache updates normally
 *
 * No links, no client method interception, no timing hacks.
 *
 * @param client - Apollo Client instance
 */
function setupCachePersistence(client: ApolloClient) {
  let persistTimeout: NodeJS.Timeout | null = null;
  const DEBOUNCE_MS = 1000;

  // Helper to schedule cache persistence (debounced)
  const schedulePersistence = () => {
    if (persistTimeout) {
      clearTimeout(persistTimeout);
    }

    persistTimeout = setTimeout(() => {
      const extracted = client.cache.extract() as any;
      apolloCachePersistence.save(extracted);
    }, DEBOUNCE_MS);
  };

  // Listen for cache resets (e.g., logout, clearStore)
  client.onResetStore(() => {
    console.log('🔄 Apollo: Cache reset, persisting...');
    schedulePersistence();
    return Promise.resolve();
  });

  // Listen for cache clears (e.g., logout with full wipe)
  client.onClearStore(() => {
    console.log('🧹 Apollo: Cache cleared');
    apolloCachePersistence.clear();
    return Promise.resolve();
  });

  // TEMPORARILY DISABLED: Testing if cache wrapping breaks Apollo's broadcast mechanism
  // TODO: Re-enable after diagnosing UI update issue
  /*
  const cache = client.cache;
  const originalWrite = cache.write.bind(cache);
  const originalEvict = cache.evict.bind(cache);
  const originalModify = cache.modify.bind(cache);
  const originalGc = cache.gc ? cache.gc.bind(cache) : null;

  cache.write = function (...args: any) {
    const result = (originalWrite as any)(...args);
    schedulePersistence(); // Persist after cache write
    return result;
  };

  cache.evict = function (...args: any) {
    const result = (originalEvict as any)(...args);
    schedulePersistence(); // Persist after cache eviction
    return result;
  };

  cache.modify = function (...args: any) {
    const result = (originalModify as any)(...args);
    schedulePersistence(); // Persist after cache modification
    return result;
  };

  if (originalGc) {
    cache.gc = function (...args: any) {
      const result = (originalGc as any)(...args);
      schedulePersistence(); // Persist after garbage collection
      return result;
    };
  }
  */

  console.log('✅ Apollo: Cache persistence hooks initialized (cache wrapping DISABLED for testing)');
}

// Initialize client synchronously
// Cache restoration is synchronous with MMKV, so no async needed
export const client = initializeClient();
