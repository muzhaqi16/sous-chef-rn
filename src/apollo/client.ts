import {
  ApolloClient,
  type Cache,
  type NormalizedCacheObject,
  type OperationVariables,
  type Reference,
} from '@apollo/client';
import { logger } from '#/utils/environment';
import { createLink } from './links/index';
import { registerApolloClient } from './links/refreshToken';
import { makeCache } from './cache';
import { apolloCachePersistence } from './offline/ApolloCachePersistence';
import { isStorageReady } from '#storage/mmkv';
import { CLIENT_NAME, CLIENT_VERSION } from './clientIdentity';
import { APOLLO_DEFAULT_OPTIONS } from './defaultOptions';

// Lazy histogram emit — defers loading of the telemetry singleton (which
// touches Environment + device ID at module init) so this module remains
// cheap to import in tests + cold start. Fire-and-forget.
const emitHistogram = (
  name: string,
  value: number,
  labels?: Record<string, string>,
): void => {
  import('#services/telemetry')
    .then(({ Telemetry }) => Telemetry.histogram(name, value, labels))
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

let cacheInstance: ReturnType<typeof makeCache> | null = null;
let cacheRestored = false;

/**
 * Restore the persisted cache. Idempotent — the first call finding storage ready
 * does the work; it cannot run at module load, since `initializeSecureStorage()`
 * is async and this module is imported inside that window. Must run BEFORE
 * `ApolloProvider` mounts, as `restore()` replaces contents wholesale.
 */
export function restorePersistedCache(): void {
  if (cacheRestored || !cacheInstance || !isStorageReady()) {
    return;
  }
  cacheRestored = true;

  const restoreT0 = performance.now();
  const persistedCache = apolloCachePersistence.load();

  if (persistedCache) {
    logger.info(
      `📦 Apollo: Restoring ${
        Object.keys(persistedCache).length
      } entities from storage`,
    );
    cacheInstance.restore(persistedCache);
  }

  // Reported on BOTH paths, carrying the outcome. `logger` is console-only and
  // console is stripped in release, so this histogram is the only evidence on a
  // real device of whether the persisted cache is restored at all — an `empty`
  // majority means every cold start refetches.
  emitHistogram('app_apollo_restore_ms', performance.now() - restoreT0, {
    outcome: persistedCache ? 'restored' : 'empty',
  });
}

/**
 * Initialize Apollo Client with cache persistence
 */
function initializeClient() {
  logger.info('🚀 Apollo: Initializing client with cache persistence');

  // Create cache instance
  const cache = makeCache();

  cacheInstance = cache;

  // Fast path only: storage is usually still initializing at this point, so
  // this is normally a no-op and App retries at the hydration boundary.
  restorePersistedCache();

  // Create link chain
  const link = createLink();

  // Create Apollo Client with defaults
  const client = new ApolloClient({
    link,
    cache,
    // Sent as apollographql-client-name / -version headers on every HTTP
    // request. The WebSocket half sends the same pair by hand — see wsLink.
    clientAwareness: {
      name: CLIENT_NAME,
      version: CLIENT_VERSION,
    },
    dataMasking: true,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
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
 * Flush any pending (debounced) cache write to disk immediately. Call when the
 * app backgrounds so the last few seconds of cache writes — including
 * optimistic local-first creates — survive a fast app-kill and paint from disk
 * on the next cold start. No-op when nothing is pending.
 */
export function flushCachePersistence() {
  apolloCachePersistence.flushPending(
    () => client.cache.extract() as NormalizedCacheObject,
  );
}

/**
 * Wrap cache methods so writes persist. Hand-rolled on `extract()`/`restore()`
 * rather than `apollo3-cache-persist`, which is pinned to `@apollo/client ^3.7`
 * and unmaintained — it was only a debounce plus a storage adapter over these
 * same two methods, which `ApolloCachePersistence` provides against MMKV.
 */
function setupCachePersistence(client: ApolloClient) {
  // Helper to schedule cache persistence
  // Uses lazy extraction so cache.extract() only runs once after debounce,
  // not on every cache operation (write, evict, modify, gc)
  const schedulePersistence = () => {
    apolloCachePersistence.scheduleExtractAndSave(
      () => client.cache.extract() as NormalizedCacheObject,
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

  // `write`/`modify` keep their generic signatures so the wrappers stay
  // assignable; `evict` is non-generic and typed via Parameters<>. None report
  // a dirty id — a query result names only `ROOT_QUERY` while normalizing into
  // any number of entities, so change detection scans the whole cache instead.
  cache.write = function <
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    writeOptions: Cache.WriteOptions<TData, TVariables>,
  ): Reference | undefined {
    const result = originalWrite(writeOptions);
    schedulePersistence();
    return result;
  };

  cache.evict = function (...args: Parameters<typeof originalEvict>) {
    const result = originalEvict(...args);
    schedulePersistence();
    return result;
  };

  cache.modify = function <
    Entity extends Record<string, unknown> = Record<string, unknown>,
  >(options: Cache.ModifyOptions<Entity>): boolean {
    const result = originalModify(options);
    schedulePersistence();
    return result;
  };

  if (originalGc) {
    cache.gc = function (gcOptions?: { resetResultCache?: boolean }) {
      // Always reset the result cache so stale query results referencing
      // evicted entities are discarded immediately. Without this, components
      // can read dangling __ref pointers and crash (production-only because
      // dev mode's loadDevMessages() masks the error).
      const options = { resetResultCache: true, ...gcOptions };
      // gc's options-param type varies across Apollo versions — assert a
      // structural callable signature rather than `as any`.
      const result = (
        originalGc as (o?: { resetResultCache?: boolean }) => string[]
      )(options);
      schedulePersistence();
      return result;
    };
  }

  logger.info('✅ Apollo: Cache persistence enabled');
}

// Initialize client synchronously
export const client = initializeClient();

// Inject the client into the token-refresh module. refreshToken can't import
// this singleton directly without forming a circular dependency, so it reads
// the reference we register here at call time.
registerApolloClient(client);
