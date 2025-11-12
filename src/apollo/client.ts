import { ApolloClient } from '@apollo/client';
import { logger } from '#/utils/environment';
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
      logger.warn('Failed to load Apollo dev messages');
    });
}

/**
 * Initialize Apollo Client with cache persistence
 */
function initializeClient() {
  logger.info('🚀 Apollo: Initializing client with cache persistence');

  // Create cache instance
  const cache = makeCache();

  // Restore persisted cache if available
  const persistedCache = apolloCachePersistence.load();
  if (persistedCache) {
    logger.info('📦 Apollo: Restoring cache from storage');
    cache.restore(persistedCache);
  }

  // Create link chain
  const link = createLink();

  // Create Apollo Client with defaults
  const client = new ApolloClient({
    link,
    cache,
    // Client identification (name/version/connectToDevTools) requires Apollo Client v4.1+
    // Current version: 4.0.5 - upgrade to enable GraphOS tracking and dev tools integration
    // Configure Apollo Client with best practices for offline-first apps
    defaultOptions: {
      query: {
        fetchPolicy: 'network-only', // Always fetch fresh data for one-time queries
        errorPolicy: 'all', // Return both data and errors for observability
      },
      mutate: {
        errorPolicy: 'all', // Mutations need full error info for handling
      },
      watchQuery: {
        // cache-and-network: Fetch from cache immediately, then update from network
        // Provides instant UI while ensuring data freshness
        fetchPolicy: 'cache-and-network',
        // After first fetch, use cache-first to reduce network calls
        nextFetchPolicy: 'cache-first',
        errorPolicy: 'all', // Return both cached data and errors for observability
        // Return partial data from cache even if some fields are missing
        returnPartialData: true,
      },
    },
    queryDeduplication: true,
  });

  // Set up cache persistence
  setupCachePersistence(client);

  logger.info('✅ Apollo: Client initialized with cache persistence');
  return client;
}

// Global reference to persistence timer for cleanup
let persistTimeout: NodeJS.Timeout | null = null;

/**
 * Cancel any pending cache persistence
 * Important: Call this during logout to prevent writing stale cache data
 */
export function cancelCachePersistence() {
  if (persistTimeout) {
    clearTimeout(persistTimeout);
    persistTimeout = null;
    logger.info('🛑 Apollo: Cache persistence timer cancelled');
  }
}

/**
 * Set up automatic cache persistence
 *
 * Wraps cache methods to persist after each operation
 * Approach from apollo3-cache-persist - cleanest way to persist cache
 */
function setupCachePersistence(client: ApolloClient) {
  // Increased from 1000ms to 3000ms to reduce persistence frequency
  // This minimizes JSON serialization overhead on the JS thread
  const DEBOUNCE_MS = 3000;

  // Helper to schedule cache persistence (debounced)
  const schedulePersistence = () => {
    if (persistTimeout) {
      clearTimeout(persistTimeout);
    }

    persistTimeout = setTimeout(() => {
      const extracted = client.cache.extract() as any;
      apolloCachePersistence.save(extracted);
      persistTimeout = null; // Clear reference after execution
    }, DEBOUNCE_MS);
  };

  // Listen for cache resets (e.g., logout, clearStore)
  client.onResetStore(() => {
    logger.info('🔄 Apollo: Cache reset, persisting...');
    schedulePersistence();
    return Promise.resolve();
  });

  // Listen for cache clears (e.g., logout with full wipe)
  client.onClearStore(() => {
    logger.info('🧹 Apollo: Cache cleared');
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

  logger.info('✅ Apollo: Cache persistence enabled');
}

// Initialize client synchronously
export const client = initializeClient();
