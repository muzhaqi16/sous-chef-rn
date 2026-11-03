import type { ApolloCache } from '@apollo/client';
import {
  isUnfilteredVariant,
  safeEvict,
  safeEvictMany,
  skipUnmatchedArgVariants,
  type ConnectionData,
} from '#/apollo/utils/cacheUpdaters';
import { isRecord } from '#/utils/isRecord';
import {
  PantryFeed_ItemsFragmentDoc,
  type PantryFeed_ItemsFragment,
  type PantryFeedSnapshotQuery,
} from '../offline/pantryFeed.generated';
import { addToPantryItemsCache, removeFromPantryItemsCache } from './items';
import { removeOptimisticPantry } from './pantry';
import { dropBatchesPage } from './restatedStack';

type ItemEdge = PantryFeed_ItemsFragment['itemsConnection']['edges'][number];
type RowTypename =
  PantryFeedSnapshotQuery['syncSnapshot']['rows'][number]['__typename'];
const STACK: Extract<RowTypename, 'PantryItem'> = 'PantryItem';
const BATCH: Extract<RowTypename, 'PantryItemBatch'> = 'PantryItemBatch';

const skipFilteredVariants = (storeFieldName: string): boolean =>
  !isUnfilteredVariant(storeFieldName);

/**
 * A held pantry's unfiltered list is whole, so a changed stack joins it. The
 * server's filtered and sorted lists are paged, where a stack missing from a
 * page may only be past it, so they are read again (`dropServerLists`).
 */
export function placePantryStack(
  cache: ApolloCache,
  pantryId: string,
  stackId: string,
): void {
  addToPantryItemsCache(
    cache,
    pantryId,
    { __typename: 'PantryItem', id: stackId },
    { skipStoreField: skipFilteredVariants },
  );
}

/** Every list of the pantry's stacks but the unfiltered one, read again when next asked. */
export function dropServerLists(cache: ApolloCache, pantryId: string): void {
  cache.modify({
    id: cache.identify({ __typename: 'Pantry', id: pantryId }),
    fields: {
      itemsConnection(existing: unknown, { storeFieldName, DELETE }) {
        return isUnfilteredVariant(storeFieldName) ? existing : DELETE;
      },
    },
  });
}

function pantryItemRoot(cache: ApolloCache, stackId: string): void {
  cache.evict({
    id: 'ROOT_QUERY',
    fieldName: 'pantryItem',
    args: { id: stackId },
  });
}

/** A stack another device removed, out of the unfiltered list and the cache. */
export function dropPantryStack(
  cache: ApolloCache,
  pantryId: string,
  stackId: string,
): void {
  removeFromPantryItemsCache(cache, pantryId, stackId, { evictItem: true });
  pantryItemRoot(cache, stackId);
  dropBatchesPage(cache, stackId);
}

/**
 * A batch its stack's page may not hold: the order is the server's, so the
 * page is read again. A batch already listed changed in place.
 */
export function placePantryBatch(
  cache: ApolloCache,
  pantryItemId: string,
  batchId: string,
): void {
  const otherStack = skipUnmatchedArgVariants({ pantryItemId });
  cache.modify({
    id: 'ROOT_QUERY',
    fields: {
      pantryItemBatchesConnection(
        existing: ConnectionData | undefined,
        { readField, storeFieldName, DELETE },
      ) {
        if (!existing || otherStack(storeFieldName)) return existing;
        const listed = (existing.edges ?? []).some(
          edge => readField<string>('id', edge.node) === batchId,
        );
        return listed ? existing : DELETE;
      },
    },
  });
}

/** A batch another device removed, and the page that listed it, whose count it moved. */
export function dropPantryBatch(cache: ApolloCache, batchId: string): void {
  cache.modify({
    id: 'ROOT_QUERY',
    fields: {
      pantryItemBatchesConnection(
        existing: ConnectionData | undefined,
        { readField, DELETE },
      ) {
        if (!existing) return existing;
        const listed = (existing.edges ?? []).some(
          edge => readField<string>('id', edge.node) === batchId,
        );
        return listed ? DELETE : existing;
      },
    },
  });
  safeEvict(cache, BATCH, batchId);
}

/** The pantry's stacks and their batches as the cache holds them, by scan. */
function pantryRowsHeld(
  cache: ApolloCache,
  pantryId: string,
): {
  stacks: string[];
  batchesOf: (stacks: ReadonlySet<string>) => string[];
  homeId: unknown;
} {
  const stored: unknown = cache.extract(false);
  const entities = isRecord(stored) ? Object.values(stored) : [];
  const pantry = isRecord(stored) ? stored[`Pantry:${pantryId}`] : undefined;
  const homeId = isRecord(pantry) ? pantry.homeId : undefined;
  const stacks = entities.flatMap((entity: unknown) =>
    isRecord(entity) &&
    entity.__typename === STACK &&
    entity.pantryId === pantryId &&
    typeof entity.id === 'string'
      ? [entity.id]
      : [],
  );
  const batchesOf = (of: ReadonlySet<string>) =>
    entities.flatMap((entity: unknown) =>
      isRecord(entity) &&
      entity.__typename === BATCH &&
      typeof entity.pantryItemId === 'string' &&
      of.has(entity.pantryItemId) &&
      typeof entity.id === 'string'
        ? [entity.id]
        : [],
    );
  return { stacks, batchesOf, homeId };
}

const asRows = (typename: string, ids: readonly string[]) =>
  ids.map(id => ({ typename, id }));

/** Writes the unfiltered list whole, past the merge that keeps a cached tail. */
function writeUnfilteredStacks(
  cache: ApolloCache,
  pantryId: string,
  ids: readonly string[],
): void {
  cache.writeFragment({
    id: cache.identify({ __typename: 'Pantry', id: pantryId }),
    fragment: PantryFeed_ItemsFragmentDoc,
    fragmentName: 'pantryFeed_items',
    overwrite: true,
    data: {
      __typename: 'Pantry',
      id: pantryId,
      itemsConnection: {
        __typename: 'PantryItemConnection',
        totalCount: ids.length,
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
        edges: ids.map(
          (id): ItemEdge => ({
            __typename: 'PantryItemEdge',
            cursor: id,
            node: { __typename: 'PantryItem', id },
          }),
        ),
      },
    },
  });
}

/**
 * Makes a pantry's stacks exactly these: the unfiltered list whole, the
 * server's lists read again, and a stack the read does not hold evicted with
 * its batches. Batch pages are read again, as their order is the server's.
 */
export function replacePantryStacks(
  cache: ApolloCache,
  pantryId: string,
  stackIds: readonly string[],
): void {
  const kept = new Set(stackIds);
  const { stacks, batchesOf } = pantryRowsHeld(cache, pantryId);
  const stale = stacks.filter(id => !kept.has(id));
  writeUnfilteredStacks(cache, pantryId, stackIds);
  dropServerLists(cache, pantryId);
  for (const id of new Set([...stacks, ...stackIds])) {
    dropBatchesPage(cache, id);
  }
  for (const id of stale) pantryItemRoot(cache, id);
  safeEvictMany(cache, [
    ...asRows(STACK, stale),
    ...asRows(BATCH, batchesOf(new Set(stale))),
  ]);
}

/** A pantry and everything in it, a row scan finding what by-id fields pin. */
export function evictPantryRows(cache: ApolloCache, pantryId: string): void {
  const { stacks, batchesOf, homeId } = pantryRowsHeld(cache, pantryId);
  for (const id of stacks) {
    pantryItemRoot(cache, id);
    dropBatchesPage(cache, id);
  }
  safeEvictMany(cache, [
    ...asRows(STACK, stacks),
    ...asRows(BATCH, batchesOf(new Set(stacks))),
  ]);
  if (typeof homeId === 'string') {
    removeOptimisticPantry(cache, homeId, pantryId, { evictEntity: false });
  }
  cache.evict({
    id: 'ROOT_QUERY',
    fieldName: 'pantry',
    args: { id: pantryId },
  });
  safeEvict(cache, 'Pantry', pantryId);
}
