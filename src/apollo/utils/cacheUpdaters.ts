import type { ApolloCache, Reference } from '@apollo/client';
import { InMemoryCache } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';
// The GraphQLCodegenDataMasking variant matches what the project's HKT
// registration (src/types/apollo-masking.d.ts) makes read/writeFragment use.
import type { GraphQLCodegenDataMasking } from '@apollo/client/masking';

type Unmasked<TData> = GraphQLCodegenDataMasking.Unmasked<TData>;
import { serializeError } from '#/utils/errorSerialization';
import { logger } from '#/utils/environment';

/**
 * gc with `resetResultCache`, so stale results referencing evicted entities are
 * discarded immediately. Only `InMemoryCache` exposes the option, hence the
 * `instanceof` narrowing — `ApolloCache.gc()`'s abstract signature omits it.
 */
export function gcResetResultCache(cache: ApolloCache): string[] {
  if (cache instanceof InMemoryCache) {
    return cache.gc({ resetResultCache: true });
  }
  return cache.gc();
}

/**
 * A Connection field value inside `cache.modify`. Apollo wraps field values as
 * `Reference | AsStoreObject<T>`, so the optional `__ref` keeps this structurally
 * compatible with `Reference`.
 */
export type ConnectionData = {
  edges?: ReadonlyArray<{ node: Reference }>;
  totalCount?: number;
  readonly __ref?: string;
};

export type InsertPosition = 'start' | 'end';

export interface AddToArrayOptions {
  /** Position to insert the item (default: 'start') */
  position?: InsertPosition;
  /** Whether to check for duplicates before adding (default: true) */
  checkDuplicates?: boolean;
}

export interface AddToConnectionOptions extends AddToArrayOptions {
  /** Update totalCount field (default: true) */
  updateTotalCount?: boolean;
  /**
   * Leave a cached variant untouched, matched on its `storeFieldName`. A
   * `cache.modify` write fans out across every `keyArgs` variant of the field,
   * so this is how a variant the new item doesn't belong to opts out.
   */
  skipStoreField?: (storeFieldName: string) => boolean;
}

export interface RemoveFromArrayOptions {
  /** Whether to evict the item from cache entirely (default: false) */
  evictItem?: boolean;
  /** Whether to run garbage collection after eviction (default: true).
   *  Set to false in multi-delete operations and call cache.gc() once at the end. */
  gc?: boolean;
}

/**
 * The serialized args inside a `storeFieldName`, or null. Apollo writes them two
 * ways — `storageLocations:{"homeId":"A"}` (array `keyArgs`) vs
 * `things({"filters":…})` (none) — so the FIRST delimiter decides the form.
 * `docs/verified-library-behaviour.md#apollo-storefieldname-has-two-serialized-forms`
 */
function storeFieldArgs(storeFieldName: string): string | null {
  const paren = storeFieldName.indexOf('(');
  const colon = storeFieldName.indexOf(':');

  if (paren !== -1 && (colon === -1 || paren < colon)) {
    const end = storeFieldName.lastIndexOf(')');
    if (end <= paren) return null;
    return storeFieldName.slice(paren + 1, end) || null;
  }
  if (colon !== -1) return storeFieldName.slice(colon + 1) || null;
  return null;
}

/**
 * Skip cached variants whose TOP-LEVEL arguments do not match — for a field keyed
 * on a plain argument (`storageLocations(homeId:)`), where the nested-`filters`
 * sibling finds nothing to compare and lets every variant through. A variant
 * carrying NONE of the named args is left alone; unparseable args are skipped.
 */
export function skipUnmatchedArgVariants(
  equals: Record<string, unknown>,
): (storeFieldName: string) => boolean {
  return storeFieldName => {
    const args = storeFieldArgs(storeFieldName);
    if (args === null) return false;

    let parsed: unknown;
    try {
      parsed = JSON.parse(args);
    } catch {
      return true;
    }
    if (!parsed || typeof parsed !== 'object') return false;

    const actual = parsed as Record<string, unknown>;
    return Object.entries(equals).some(
      ([key, value]) => key in actual && actual[key] !== value,
    );
  };
}

/**
 * Skip cached variants whose nested `filters` argument does not match. The
 * unfiltered variant always takes the write; a filtered one only when every active
 * filter is a key in `equals` and matches. Anything else — search text, a tag set,
 * a range — skips: a briefly-missing row heals on the next read, a misplaced one does not.
 */
export function skipUnmatchedFilterVariants(
  equals: Record<string, unknown>,
): (storeFieldName: string) => boolean {
  return storeFieldName => {
    const argsStart = storeFieldName.indexOf('(');
    if (argsStart === -1) return false;

    const args = storeFieldName.slice(argsStart + 1, -1);
    if (!args) return false;

    let parsed: unknown;
    try {
      parsed = JSON.parse(args);
    } catch {
      // Cannot prove the variant matches — skip and let the next read fix it.
      return true;
    }

    const filters = (parsed as { filters?: unknown } | null)?.filters;
    if (!filters || typeof filters !== 'object') return false;

    return Object.entries(filters).some(([key, value]) => {
      const isActive =
        value !== null &&
        value !== undefined &&
        value !== '' &&
        !(Array.isArray(value) && value.length === 0);
      if (!isActive) return false;
      return !(key in equals) || equals[key] !== value;
    });
  };
}

/**
 * Add an item to a Query root Connection field (edges, not a flat array).
 * `cache.modify` fires for EVERY cached `keyArgs` variant, so an item whose
 * membership depends on filters/orderBy needs `skipStoreField` or a refetch.
 * Edge typename assumes Relay (`Foo` → `FooEdge`); anything else is wrong silently.
 */
export function createAddToQueryConnectionUpdater<T extends { id: string }>(
  fieldName: string,
  itemTypename: string,
) {
  return (
    cache: ApolloCache,
    newItem: T,
    options: AddToConnectionOptions = {},
  ): boolean => {
    const {
      position = 'start',
      checkDuplicates = true,
      updateTotalCount = true,
      skipStoreField,
    } = options;

    try {
      return cache.modify({
        fields: {
          [fieldName](
            existingConnection: ConnectionData = {},
            { toReference, readField, storeFieldName },
          ) {
            if (skipStoreField?.(storeFieldName)) return existingConnection;

            const newItemRef = toReference(newItem, true);
            if (!newItemRef) return existingConnection;

            const existingEdges = existingConnection?.edges || [];

            if (checkDuplicates) {
              const exists = existingEdges.some(
                edge => readField('id', edge?.node) === newItem.id,
              );
              if (exists) return existingConnection;
            }

            const newEdge = {
              __typename: `${itemTypename}Edge`,
              node: newItemRef,
              cursor: '', // Will be populated on next fetch
            };

            const edges =
              position === 'start'
                ? [newEdge, ...existingEdges]
                : [...existingEdges, newEdge];

            const totalCount = updateTotalCount
              ? (existingConnection?.totalCount || 0) + 1
              : existingConnection?.totalCount;

            return {
              ...existingConnection,
              edges,
              ...(updateTotalCount && { totalCount }),
            };
          },
        },
      });
    } catch (error) {
      logger.warn(
        `Cache update failed for adding to ${fieldName}:`,
        serializeError(error),
      );
      return false;
    }
  };
}

/**
 * Remove an item from a Query root Connection field. `evictItem: true` evicts the
 * entity and gcs — the connection's `read` policy then drops the dangling edge and
 * decrements `totalCount` on the next read. `evictItem: false` keeps the entity
 * and filters the edge here instead.
 */
export function createRemoveFromQueryConnectionUpdater(
  fieldName: string,
  typename: string,
) {
  return (
    cache: ApolloCache,
    itemId: string,
    options: RemoveFromArrayOptions & { updateTotalCount?: boolean } = {},
  ): void => {
    const { evictItem = false, gc = true, updateTotalCount = true } = options;

    try {
      if (evictItem) {
        const cacheId = cache.identify({ __typename: typename, id: itemId });
        if (!cacheId) return;
        cache.evict({ id: cacheId });
        if (gc) {
          gcResetResultCache(cache);
        }
        return;
      }

      cache.modify({
        fields: {
          [fieldName](existingConnection: ConnectionData = {}, { readField }) {
            const existingEdges = existingConnection?.edges || [];
            const edges = existingEdges.filter(
              edge => readField('id', edge?.node) !== itemId,
            );
            const totalCount = updateTotalCount
              ? Math.max(0, (existingConnection?.totalCount || 0) - 1)
              : existingConnection?.totalCount;

            return {
              ...existingConnection,
              edges,
              ...(updateTotalCount && { totalCount }),
            };
          },
        },
      });
    } catch (error) {
      logger.warn(
        `Cache update failed for removing from ${fieldName}:`,
        serializeError(error),
      );
    }
  };
}

/**
 * Add an item to a Connection field nested in a parent entity. With `keyArgs`
 * (e.g. `Pantry.itemsConnection` on `['filters','orderBy']`) `cache.modify` runs
 * for EVERY cached variant and `position` ignores each variant's `orderBy` — scope
 * it with `skipStoreField`. Edge typename assumes Relay (`Foo` → `FooEdge`).
 */
export function createAddToParentConnectionUpdater<T extends { id: string }>(
  parentTypename: string,
  connectionField: string,
  itemTypename: string,
) {
  return (
    cache: ApolloCache,
    parentId: string,
    newItem: T,
    options: AddToConnectionOptions = {},
  ): boolean => {
    const {
      position = 'start',
      checkDuplicates = true,
      updateTotalCount = true,
      skipStoreField,
    } = options;

    try {
      const parentCacheId = cache.identify({
        __typename: parentTypename,
        id: parentId,
      });

      if (!parentCacheId) {
        logger.warn(
          `Parent entity not found in cache: ${parentTypename}:${parentId}`,
        );
        return false;
      }

      return cache.modify({
        id: parentCacheId,
        fields: {
          [connectionField](
            existingConnection: ConnectionData = {},
            { readField, toReference, storeFieldName },
          ) {
            // `cache.modify` runs this for EVERY cached variant of a keyed field;
            // without the opt-out a pantry notification lands in the recipes feed.
            if (skipStoreField?.(storeFieldName)) return existingConnection;

            const newItemRef = toReference(newItem, true);

            if (!newItemRef) return existingConnection;

            const existingEdges = existingConnection?.edges || [];

            if (checkDuplicates) {
              const exists = existingEdges.some(
                edge => readField('id', edge?.node) === newItem.id,
              );

              if (exists) {
                return existingConnection;
              }
            }

            const newEdge = {
              __typename: `${itemTypename}Edge`,
              node: newItemRef,
              cursor: '', // Will be populated on next fetch
            };

            const edges =
              position === 'start'
                ? [newEdge, ...existingEdges]
                : [...existingEdges, newEdge];

            const totalCount = updateTotalCount
              ? (existingConnection?.totalCount || 0) + 1
              : existingConnection?.totalCount;

            return {
              ...existingConnection,
              edges,
              ...(updateTotalCount && { totalCount }),
            };
          },
        },
      });
    } catch (error) {
      logger.warn(
        `Cache update failed for adding to ${parentTypename}.${connectionField}:`,
        serializeError(error),
      );
      return false;
    }
  };
}

/**
 * Add an item to a non-Connection array field nested in an entity. With `keyArgs`
 * the ref is inserted into every cached variant regardless of its filter/sort —
 * the same caveat as {@link createAddToParentConnectionUpdater}.
 */
export function createAddToParentArrayUpdater<T extends { id: string }>(
  parentTypename: string,
  arrayField: string,
) {
  return (
    cache: ApolloCache,
    parentId: string,
    newItem: T,
    options: AddToArrayOptions = {},
  ): boolean => {
    const { position = 'start', checkDuplicates = true } = options;

    try {
      const parentCacheId = cache.identify({
        __typename: parentTypename,
        id: parentId,
      });

      if (!parentCacheId) {
        logger.warn(
          `Parent entity not found in cache: ${parentTypename}:${parentId}`,
        );
        return false;
      }

      return cache.modify({
        id: parentCacheId,
        fields: {
          [arrayField](
            existingItems: readonly Reference[] = [],
            { toReference, readField },
          ) {
            const newItemRef = toReference(newItem, true);

            if (!newItemRef) return existingItems;

            if (checkDuplicates) {
              const exists = existingItems.some(
                itemRef => readField('id', itemRef) === newItem.id,
              );

              if (exists) return existingItems;
            }

            return position === 'start'
              ? [newItemRef, ...existingItems]
              : [...existingItems, newItemRef];
          },
        },
      });
    } catch (error) {
      logger.warn(
        `Cache update failed for adding to ${parentTypename}.${arrayField}:`,
        serializeError(error),
      );
      return false;
    }
  };
}

/**
 * Remove an item from a parent entity's Connection field. `evictItem: true` evicts
 * and gcs, letting the connection's `read` policy drop the dangling edge and
 * decrement `totalCount` — self-healing across every keyed variant.
 * `evictItem: false` filters here instead, which runs for every cached variant.
 */
export function createRemoveFromParentConnectionUpdater(
  parentTypename: string,
  connectionField: string,
  itemTypename: string,
) {
  return (
    cache: ApolloCache,
    parentId: string,
    itemId: string,
    options: RemoveFromArrayOptions & { updateTotalCount?: boolean } = {},
    // Reports whether an edge was actually removed, so a caller pairing this with
    // a counter — or `totalCount` — adjusts only on a real membership change.
  ): boolean => {
    const { evictItem = false, gc = true, updateTotalCount = true } = options;

    try {
      if (evictItem) {
        const cacheId = cache.identify({
          __typename: itemTypename,
          id: itemId,
        });
        if (!cacheId) return false;
        cache.evict({ id: cacheId });
        if (gc) {
          gcResetResultCache(cache);
        }
        return true;
      }

      const parentCacheId = cache.identify({
        __typename: parentTypename,
        id: parentId,
      });

      if (!parentCacheId) {
        logger.warn(
          `Parent entity not found in cache: ${parentTypename}:${parentId}`,
        );
        return false;
      }

      let removed = false;

      cache.modify({
        id: parentCacheId,
        fields: {
          [connectionField](
            existingConnection: ConnectionData = {},
            { readField },
          ) {
            const existingEdges = existingConnection?.edges || [];
            const edges = existingEdges.filter(
              edge => readField('id', edge?.node) !== itemId,
            );
            if (edges.length === existingEdges.length)
              return existingConnection;

            removed = true;
            const totalCount = updateTotalCount
              ? Math.max(0, (existingConnection?.totalCount || 0) - 1)
              : existingConnection?.totalCount;

            return {
              ...existingConnection,
              edges,
              ...(updateTotalCount && { totalCount }),
            };
          },
        },
      });

      return removed;
    } catch (error) {
      logger.warn(
        `Cache update failed for removing from ${parentTypename}.${connectionField}:`,
        serializeError(error),
      );
      return false;
    }
  };
}

/**
 * Remove an item from a parent entity's flat array field. With `keyArgs` the filter
 * runs for every cached variant — the same caveat as
 * {@link createRemoveFromParentConnectionUpdater}.
 */
export function createRemoveFromParentArrayUpdater(
  parentTypename: string,
  arrayField: string,
  itemTypename: string,
) {
  return (
    cache: ApolloCache,
    parentId: string,
    itemId: string,
    options: RemoveFromArrayOptions = {},
  ): void => {
    const { evictItem = false, gc = true } = options;

    try {
      const parentCacheId = cache.identify({
        __typename: parentTypename,
        id: parentId,
      });

      if (!parentCacheId) {
        logger.warn(
          `Parent entity not found in cache: ${parentTypename}:${parentId}`,
        );
        return;
      }

      cache.modify({
        id: parentCacheId,
        fields: {
          [arrayField](
            existingItems: readonly Reference[] = [],
            { readField },
          ) {
            return existingItems.filter(
              itemRef => readField('id', itemRef) !== itemId,
            );
          },
        },
      });

      if (evictItem) {
        const itemCacheId = cache.identify({
          __typename: itemTypename,
          id: itemId,
        });
        if (itemCacheId) {
          cache.evict({ id: itemCacheId });
          if (gc) {
            gcResetResultCache(cache);
          }
        }
      }
    } catch (error) {
      logger.warn(
        `Cache update failed for removing from ${parentTypename}.${arrayField}:`,
        serializeError(error),
      );
    }
  };
}

/**
 * Set scalar fields on a cached entity. The value type is deliberately narrow: for
 * objects, arrays or `Reference` writes call `cache.modify` directly, so the field
 * modifier can compose the new value from `existing` plus its helpers.
 */
export function setCachedFields(
  cache: ApolloCache,
  typename: string,
  entityId: string,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
): void {
  try {
    const cacheId = cache.identify({ __typename: typename, id: entityId });
    if (!cacheId) return;

    const fields: Record<
      string,
      () => string | number | boolean | null | undefined
    > = {};
    for (const [key, value] of Object.entries(fieldValues)) {
      fields[key] = () => value;
    }

    cache.modify({ id: cacheId, fields });
  } catch (error) {
    logger.warn(
      `Cache update failed for ${typename}:${entityId}:`,
      serializeError(error),
    );
  }
}

/**
 * Snapshot an entity via its fragment, write `patch` over it PERMANENTLY (not
 * Apollo's transient optimistic layer, so it survives a queued mutation), and
 * return a revert. The fragment must select every patched field plus `updatedAt`,
 * and `readFragment` returns null on ANY missing one — write and revert then no-op.
 */
export function applyOptimisticFragmentPatch<TFragment>(
  cache: ApolloCache,
  entity: { typename: string; id: string },
  doc: {
    fragment: TypedDocumentNode<TFragment, unknown>;
    fragmentName: string;
  },
  patch: Partial<Unmasked<TFragment>>,
  label: string,
): () => void {
  const cacheId = cache.identify({
    __typename: entity.typename,
    id: entity.id,
  });
  // readFragment/writeFragment operate on Unmasked<TFragment> — Apollo's own
  // signature for the round trip, not a mask bypass; these fragments are flat.
  const snapshot = cacheId
    ? cache.readFragment<TFragment>({
        id: cacheId,
        fragment: doc.fragment,
        fragmentName: doc.fragmentName,
      })
    : null;

  const write = (data: Unmasked<TFragment>, writeLabel: string) => {
    try {
      cache.writeFragment({
        id: cacheId,
        fragment: doc.fragment,
        fragmentName: doc.fragmentName,
        data,
      });
    } catch (error) {
      logger.warn(
        `Cache update failed for ${writeLabel}:`,
        serializeError(error),
      );
    }
  };

  if (snapshot) {
    write(
      { ...snapshot, ...patch, updatedAt: new Date().toISOString() },
      `${label} (optimistic)`,
    );
  }

  return () => {
    if (snapshot) {
      write(snapshot, `Revert ${label}`);
    }
  };
}

/** Evict one entity and gc(resetResultCache); use instead of evict + gc. */
/** Retains on one id, bounded so a miscount cannot spin. */
const MAX_RETAIN_DRAIN = 16;

export function safeEvict(
  cache: ApolloCache,
  typename: string,
  itemId: string,
): void {
  try {
    const cacheId = cache.identify({ __typename: typename, id: itemId });
    if (!cacheId) return;
    cache.evict({ id: cacheId });
    // `evict` drops the record but not the retains `writeFragment` took, which
    // `extract()` persists. `retain` counts, so drain it.
    const retaining = cache as { release?: (rootId: string) => number };
    for (let i = 0; i < MAX_RETAIN_DRAIN; i++) {
      if (!retaining.release || retaining.release(cacheId) <= 0) break;
    }
    gcResetResultCache(cache);
  } catch (error) {
    logger.warn(
      `Cache eviction failed for ${typename}:${itemId}:`,
      serializeError(error),
    );
  }
}

/**
 * Reconcile a client-minted id with the server's after a create: when the server
 * resolves to an EXISTING row, evict the stale client-id entity so its dangling
 * edge is dropped and one row stands. `clientId` MUST come off the mutation's own
 * `variables` at the call site, never a shared ref, so overlapping creates hold.
 */
export function adoptServerEntityId(
  cache: ApolloCache,
  typename: string,
  serverId: string,
  clientId: string | null | undefined,
): void {
  if (clientId && serverId !== clientId) {
    safeEvict(cache, typename, clientId);
  }
}

/** Evict several entities with a single gc pass. */
export function safeEvictMany(
  cache: ApolloCache,
  items: ReadonlyArray<{ typename: string; id: string }>,
): void {
  try {
    for (const { typename, id } of items) {
      const cacheId = cache.identify({ __typename: typename, id });
      if (cacheId) {
        cache.evict({ id: cacheId });
      }
    }
    gcResetResultCache(cache);
  } catch (error) {
    logger.warn('Batch cache eviction failed:', serializeError(error));
  }
}
