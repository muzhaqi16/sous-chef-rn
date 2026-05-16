import { ApolloClient } from '@apollo/client';
import { logger } from '#/utils/environment';
import { createLink } from './links/index';
import { makeCache } from './cache';
import { apolloCachePersistence } from './offline/ApolloCachePersistence';
import packageJson from '../../package.json';

// Lazy histogram emit — defers loading of the telemetry singleton (which
// touches Environment + device ID at module init) so this module remains
// cheap to import in tests + cold start. Fire-and-forget.
const emitHistogram = (name: string, value: number): void => {
  import('#services/telemetry')
    .then(({ Telemetry }) => Telemetry.histogram(name, value))
    .catch(() => {
      // Telemetry is best-effort; never block startup on failures.
    });
};

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

  // Phase 1: sync restore of critical entities (~30, ~5ms) — needed by
  // cache-first queries on the first render. Phase 2 (bulk restore) is
  // deferred to the app entry; see startDeferredCacheRestore.
  const criticalT0 = performance.now();
  const criticalCache = apolloCachePersistence.loadCritical();
  if (criticalCache) {
    logger.info('📦 Apollo: Restoring critical cache from storage');
    cache.restore(criticalCache);
    emitHistogram(
      'app_apollo_critical_restore_ms',
      performance.now() - criticalT0,
    );
  } else {
    // Migration fallback: read old single-key format
    const persistedCache = apolloCachePersistence.load();
    if (persistedCache) {
      logger.info('📦 Apollo: Restoring cache from legacy storage');
      cache.restore(persistedCache);
      emitHistogram(
        'app_apollo_legacy_restore_ms',
        performance.now() - criticalT0,
      );
    }
  }

  // Create link chain
  const link = createLink();

  // Create Apollo Client with defaults
  const client = new ApolloClient({
    link,
    cache,
    clientAwareness: {
      name: 'sous-chef-app',
      version: packageJson.version,
    },
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
      },
    },
    queryDeduplication: true,
  });

  // Set up cache persistence
  setupCachePersistence(client);

  logger.info('✅ Apollo: Client initialized with cache persistence');
  return client;
}

/**
 * Cancel any pending cache persistence
 * Important: Call this during logout to prevent writing stale cache data
 */
export function cancelCachePersistence() {
  apolloCachePersistence.cancel();
  logger.info('🛑 Apollo: Cache persistence timer cancelled');
}

/**
 * Set up automatic cache persistence
 *
 * Wraps cache methods to persist after each operation
 * Approach from apollo3-cache-persist - cleanest way to persist cache
 */
function setupCachePersistence(client: ApolloClient) {
  // Helper to schedule cache persistence
  // Uses lazy extraction so cache.extract() only runs once after debounce,
  // not on every cache operation (write, evict, modify, gc)
  const schedulePersistence = () => {
    apolloCachePersistence.scheduleExtractAndSave(
      () => client.cache.extract() as any, // justified: NormalizedCacheObject shape varies by Apollo version
    );
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

  // justified: wrapping Apollo cache methods requires `any` — internal method signatures are not public API
  cache.write = function (...args: any) {
    const result = (originalWrite as any)(...args);
    // Mark the written entity's cache ID as dirty for incremental persistence
    const dataId = args[0]?.dataId;
    if (dataId) {
      apolloCachePersistence.markDirty([dataId]);
    }
    schedulePersistence();
    return result;
  };

  cache.evict = function (...args: any) {
    const result = (originalEvict as any)(...args);
    const id = args[0]?.id;
    if (id) {
      apolloCachePersistence.markDirty([id]);
    }
    schedulePersistence();
    return result;
  };

  cache.modify = function (...args: any) {
    const result = (originalModify as any)(...args);
    const id = args[0]?.id;
    if (id) {
      apolloCachePersistence.markDirty([id]);
    }
    schedulePersistence();
    return result;
  };

  if (originalGc) {
    cache.gc = function (...args: any) {
      // Always reset the result cache so stale query results referencing
      // evicted entities are discarded immediately. Without this, components
      // can read dangling __ref pointers and crash (production-only because
      // dev mode's loadDevMessages() masks the error).
      const options = { resetResultCache: true, ...args[0] };
      const result = (originalGc as any)(options);
      schedulePersistence();
      return result;
    };
  }

  logger.info('✅ Apollo: Cache persistence enabled');
}

// Initialize client synchronously
export const client = initializeClient();
