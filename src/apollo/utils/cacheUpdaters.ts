import type { ApolloCache, Cache, Reference } from '@apollo/client';
import { InMemoryCache } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';
import type { ModifierDetails } from '@apollo/client/cache';
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
function gcResetResultCache(cache: ApolloCache): string[] {
  if (cache instanceof InMemoryCache) {
    return cache.gc({ resetResultCache: true });
  }
  return cache.gc();
}

/**
 * Drop the retain `writeFragment`/`writeQuery` adds for every id it writes
 * explicitly. Without it the entity stays a retained root: `gc()` skips it,
 * `extract()` pins it under `__META.extraRootIds`, and `restore()` re-retains it
 * on the next launch. `release` is `InMemoryCache`-only, hence the narrowing.
 */
export function releaseEntity(cache: ApolloCache, cacheId: string): void {
  if (!(cache instanceof InMemoryCache)) return;
  // Each explicit write retains once, so an entity written across several
  // fragments holds several. `release` returns the remaining count; stopping at
  // the first would leave it a retained root, which is what `gc()` skips.
  let retained = cache.release(cacheId);
  while (retained > 0) {
    retained = cache.release(cacheId);
  }
}

/** Evict one entity, drop its retains and gc. False when the id is unknown. */
function evictEntity(
  cache: ApolloCache,
  typename: string,
  id: string,
): boolean {
  const cacheId = cache.identify({ __typename: typename, id });
  if (!cacheId) return false;
  cache.evict({ id: cacheId });
  releaseEntity(cache, cacheId);
  gcResetResultCache(cache);
  return true;
}

function identifyParent(
  cache: ApolloCache,
  typename: string,
  id: string,
): string | undefined {
  const cacheId = cache.identify({ __typename: typename, id });
  if (!cacheId) {
    logger.warn(`Parent entity not found in cache: ${typename}:${id}`);
  }
  return cacheId;
}

function tryModify(
  cache: ApolloCache,
  label: string,
  options: Cache.ModifyOptions,
): boolean {
  try {
    return cache.modify(options);
  } catch (error) {
    logger.warn(`Cache update failed for ${label}:`, serializeError(error));
    return false;
  }
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

/** What a modifier receives: a field the server returned as `null` is stored as `null`. */
type StoredConnection = ConnectionData | null | undefined;
type StoredRefs = readonly Reference[] | null | undefined;

type InsertPosition = 'start' | 'end';

export interface AddToConnectionOptions {
  /** Where the new edge goes (default: 'start') */
  position?: InsertPosition;
  /**
   * Leave a cached variant untouched, matched on its `storeFieldName`. A
   * `cache.modify` write fans out across every `keyArgs` variant of the field,
   * so this is how a variant the new item doesn't belong to opts out.
   */
  skipStoreField?: (storeFieldName: string) => boolean;
}

interface RemoveOptions {
  /** Evict the entity itself (and gc) rather than only dropping its edge. */
  evictItem?: boolean;
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

type ParsedStoreFieldArgs =
  | { args: Record<string, unknown> }
  | { unparseable: true }
  | null;

/** Null for a variant without arguments; `unparseable` when they are not JSON. */
function parseStoreFieldArgs(storeFieldName: string): ParsedStoreFieldArgs {
  const raw = storeFieldArgs(storeFieldName);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { unparseable: true };
  }
  if (!parsed || typeof parsed !== 'object') return null;
  return { args: parsed as Record<string, unknown> };
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
    const parsed = parseStoreFieldArgs(storeFieldName);
    if (!parsed) return false;
    if ('unparseable' in parsed) return true;
    const { args } = parsed;
    return Object.entries(equals).some(
      ([key, value]) => key in args && args[key] !== value,
    );
  };
}

function isActiveFilter(value: unknown): boolean {
  return (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    !(Array.isArray(value) && value.length === 0)
  );
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
    const parsed = parseStoreFieldArgs(storeFieldName);
    if (!parsed) return false;
    if ('unparseable' in parsed) return true;
    const { filters } = parsed.args;
    if (!filters || typeof filters !== 'object') return false;
    return Object.entries(filters).some(
      ([key, value]) =>
        isActiveFilter(value) && (!(key in equals) || equals[key] !== value),
    );
  };
}

/**
 * Edge typename assumes Relay (`Foo` → `FooEdge`); anything else is wrong
 * silently. `totalCount` moves only where the record already holds one, so an
 * add never introduces a count a query then reads as a cache hit.
 */
function addEdgeModifier<T extends { id: string }>(
  newItem: T,
  itemTypename: string,
  { position = 'start', skipStoreField }: AddToConnectionOptions,
) {
  return (
    existing: StoredConnection,
    { toReference, readField, storeFieldName }: ModifierDetails,
  ) => {
    // Every "leave alone" path returns `existing` as is: Apollo reads an
    // `undefined` over a stored `null` as a delete.
    if (skipStoreField?.(storeFieldName)) return existing;
    const newItemRef = toReference(newItem, true);
    if (!newItemRef) return existing;

    const edges = existing?.edges ?? [];
    if (edges.some(edge => readField('id', edge.node) === newItem.id)) {
      return existing;
    }

    const newEdge = {
      __typename: `${itemTypename}Edge`,
      node: newItemRef,
      cursor: '',
    };
    const totalCount = existing?.totalCount;
    return {
      ...existing,
      edges: position === 'start' ? [newEdge, ...edges] : [...edges, newEdge],
      ...(typeof totalCount === 'number' && { totalCount: totalCount + 1 }),
    };
  };
}

function removeEdgeModifier(itemId: string, onRemoved: () => void) {
  return (existing: StoredConnection, { readField }: ModifierDetails) => {
    const edges = existing?.edges ?? [];
    const kept = edges.filter(edge => readField('id', edge.node) !== itemId);
    if (kept.length === edges.length) return existing;
    onRemoved();
    const totalCount = existing?.totalCount;
    return {
      ...existing,
      edges: kept,
      ...(typeof totalCount === 'number' && {
        totalCount: Math.max(0, totalCount - 1),
      }),
    };
  };
}

function addRefModifier<T extends { id: string }>(
  newItem: T,
  position: InsertPosition,
) {
  return (
    existing: StoredRefs,
    { toReference, readField }: ModifierDetails,
  ) => {
    const newItemRef = toReference(newItem, true);
    if (!newItemRef) return existing;
    const refs = existing ?? [];
    if (refs.some(ref => readField('id', ref) === newItem.id)) return existing;
    return position === 'start' ? [newItemRef, ...refs] : [...refs, newItemRef];
  };
}

function removeRefModifier(itemId: string, onRemoved: () => void) {
  return (existing: StoredRefs, { readField }: ModifierDetails) => {
    const refs = existing ?? [];
    const kept = refs.filter(ref => readField('id', ref) !== itemId);
    if (kept.length === refs.length) return existing;
    onRemoved();
    return kept;
  };
}

/**
 * Add an item to a Query root Connection field. `cache.modify` fires for EVERY
 * cached `keyArgs` variant, so an item whose membership depends on filters or
 * orderBy needs `skipStoreField` or a refetch.
 */
export function createAddToQueryConnectionUpdater<T extends { id: string }>(
  fieldName: string,
  itemTypename: string,
) {
  return (
    cache: ApolloCache,
    newItem: T,
    options: AddToConnectionOptions = {},
  ): boolean =>
    tryModify(cache, `adding to ${fieldName}`, {
      fields: { [fieldName]: addEdgeModifier(newItem, itemTypename, options) },
    });
}

/**
 * Remove an item from a Query root Connection field. `evictItem: true` evicts the
 * entity and gcs — the connection's `read` policy then drops the dangling edge and
 * decrements `totalCount` on the next read. Otherwise the edge is filtered here.
 * Reports whether anything was removed.
 */
export function createRemoveFromQueryConnectionUpdater(
  fieldName: string,
  typename: string,
) {
  return (
    cache: ApolloCache,
    itemId: string,
    { evictItem = false }: RemoveOptions = {},
  ): boolean => {
    try {
      if (evictItem) return evictEntity(cache, typename, itemId);
      let removed = false;
      cache.modify({
        fields: {
          [fieldName]: removeEdgeModifier(itemId, () => {
            removed = true;
          }),
        },
      });
      return removed;
    } catch (error) {
      logger.warn(
        `Cache update failed for removing from ${fieldName}:`,
        serializeError(error),
      );
      return false;
    }
  };
}

/**
 * Add an item to a Connection field nested in a parent entity. With `keyArgs`
 * (e.g. `Pantry.itemsConnection` on `['filters','orderBy']`) `cache.modify` runs
 * for EVERY cached variant and `position` ignores each variant's `orderBy` — scope
 * it with `skipStoreField`.
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
    const id = identifyParent(cache, parentTypename, parentId);
    if (!id) return false;
    return tryModify(cache, `adding to ${parentTypename}.${connectionField}`, {
      id,
      fields: {
        [connectionField]: addEdgeModifier(newItem, itemTypename, options),
      },
    });
  };
}

/**
 * Remove an item from a parent entity's Connection field; the same two modes as
 * {@link createRemoveFromQueryConnectionUpdater}. Reports whether an edge was
 * removed, so a caller pairing this with a counter adjusts only on a real change.
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
    { evictItem = false }: RemoveOptions = {},
  ): boolean => {
    try {
      if (evictItem) return evictEntity(cache, itemTypename, itemId);
      const id = identifyParent(cache, parentTypename, parentId);
      if (!id) return false;
      let removed = false;
      cache.modify({
        id,
        fields: {
          [connectionField]: removeEdgeModifier(itemId, () => {
            removed = true;
          }),
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
    { position = 'start' }: { position?: InsertPosition } = {},
  ): boolean => {
    const id = identifyParent(cache, parentTypename, parentId);
    if (!id) return false;
    return tryModify(cache, `adding to ${parentTypename}.${arrayField}`, {
      id,
      fields: { [arrayField]: addRefModifier(newItem, position) },
    });
  };
}

/**
 * Remove an item from a parent entity's flat array field. A flat array has no
 * `read` policy to drop a dangling ref, so the ref is filtered out even when the
 * entity is evicted.
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
    { evictItem = false }: RemoveOptions = {},
  ): boolean => {
    try {
      const id = identifyParent(cache, parentTypename, parentId);
      if (!id) return false;
      let removed = false;
      cache.modify({
        id,
        fields: {
          [arrayField]: removeRefModifier(itemId, () => {
            removed = true;
          }),
        },
      });
      if (evictItem) evictEntity(cache, itemTypename, itemId);
      return removed;
    } catch (error) {
      logger.warn(
        `Cache update failed for removing from ${parentTypename}.${arrayField}:`,
        serializeError(error),
      );
      return false;
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

/** Evict one entity, release its retains and gc; use instead of evict + gc. */
export function safeEvict(
  cache: ApolloCache,
  typename: string,
  itemId: string,
): void {
  try {
    evictEntity(cache, typename, itemId);
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
