import type {
  Cache,
  InMemoryCache,
  OperationVariables,
  Reference,
} from '@apollo/client';

/**
 * Runs `listener` after every write to `cache`, by whichever method. The
 * InMemoryCache itself, not `client.cache`: only it declares gc's
 * `resetResultCache` option.
 */
export function onCacheWrite(cache: InMemoryCache, listener: () => void): void {
  const originalWrite = cache.write.bind(cache);
  const originalEvict = cache.evict.bind(cache);
  const originalModify = cache.modify.bind(cache);
  const originalGc = cache.gc.bind(cache);

  // `write`/`modify` keep their generic signatures so the wrappers stay
  // assignable; `evict` is non-generic and typed via Parameters<>. None report
  // a dirty id: a query result names only `ROOT_QUERY` while normalizing into
  // any number of entities.
  cache.write = function <
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    writeOptions: Cache.WriteOptions<TData, TVariables>,
  ): Reference | undefined {
    const result = originalWrite(writeOptions);
    listener();
    return result;
  };

  cache.evict = function (...args: Parameters<typeof originalEvict>) {
    const result = originalEvict(...args);
    listener();
    return result;
  };

  cache.modify = function <
    Entity extends Record<string, unknown> = Record<string, unknown>,
  >(options: Cache.ModifyOptions<Entity>): boolean {
    const result = originalModify(options);
    listener();
    return result;
  };

  // No forced `resetResultCache`: an evict already invalidates every read of
  // the entity. Verified: #apollo-gc-needs-no-result-cache-reset-to-drop-evicted-entities
  cache.gc = function (gcOptions?: { resetResultCache?: boolean }) {
    const result = originalGc(gcOptions);
    listener();
    return result;
  };
}
