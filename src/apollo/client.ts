import { ApolloClient } from '@apollo/client';
import { createLink } from './links';
import { makeCache } from './cache';
import { apolloCachePersistence } from './offline/ApolloCachePersistence';

// Load Apollo dev messages in development for better error reporting
if (__DEV__) {
  import('@apollo/client/dev')
    .then(({ loadDevMessages, loadErrorMessages }) => {
      loadDevMessages();
      loadErrorMessages();
    })
    .catch(() => {
      // Silently fail if dev messages can't be loaded
      console.warn('Failed to load Apollo dev messages');
    });
}

/**
 * Initialize Apollo Client with cache persistence
 */
function initializeClient() {
  console.log('🚀 Apollo: Initializing client with cache persistence');

  // Create cache instance
  const cache = makeCache();

  // Restore persisted cache if available
  const persistedCache = apolloCachePersistence.load();
  if (persistedCache) {
    console.log('📦 Apollo: Restoring cache from storage');
    cache.restore(persistedCache);
  }

  // Create link chain
  const link = createLink();

  // Create Apollo Client with defaults
  const client = new ApolloClient({
    link,
    cache,
    // Configure to watch cache changes from mutations
    // Use cache-first for all queries - no network calls when offline
    defaultOptions: {
      query: {
        fetchPolicy: 'cache-first', // Try cache first, network if cache miss
        errorPolicy: 'ignore', // Return cached data on errors - crucial for offline
      },
      mutate: {
        errorPolicy: 'all', // Mutations need full error info for handling
      },
      watchQuery: {
        // cache-first prevents unnecessary network calls
        // Especially important for offline - doesn't attempt network if cache has data
        fetchPolicy: 'cache-first',
        nextFetchPolicy: 'cache-first',
        errorPolicy: 'ignore', // Return cached data on errors - crucial for offline
      },
    },
    queryDeduplication: true,
  });

  // Set up cache persistence
  setupCachePersistence(client);

  console.log('✅ Apollo: Client initialized with cache persistence');
  return client;
}

/**
 * Set up automatic cache persistence
 *
 * Wraps cache methods to persist after each operation
 * Approach from apollo3-cache-persist - cleanest way to persist cache
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

  // Wrap cache methods to persist after operations
  const cache = client.cache;
  const originalWrite = cache.write.bind(cache);
  const originalEvict = cache.evict.bind(cache);
  const originalModify = cache.modify.bind(cache);
  const originalGc = cache.gc ? cache.gc.bind(cache) : null;

  cache.write = function (...args: any) {
    const result = (originalWrite as any)(...args);
    schedulePersistence();
    return result;
  };

  cache.evict = function (...args: any) {
    const result = (originalEvict as any)(...args);
    schedulePersistence();
    return result;
  };

  cache.modify = function (...args: any) {
    const result = (originalModify as any)(...args);
    schedulePersistence();
    return result;
  };

  if (originalGc) {
    cache.gc = function (...args: any) {
      const result = (originalGc as any)(...args);
      schedulePersistence();
      return result;
    };
  }

  console.log('✅ Apollo: Cache persistence enabled');
}

// Initialize client synchronously
export const client = initializeClient();
