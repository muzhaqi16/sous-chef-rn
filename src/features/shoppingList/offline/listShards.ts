import type {
  ApolloCache,
  NormalizedCacheObject,
  Unmasked,
} from '@apollo/client';
import {
  clearPositions,
  forgetPosition,
  heldScopes,
  holdPosition,
  type FeedPosition,
} from '#/apollo/feed/feedPositions';
import { getApolloClient } from '#/apollo/clientRegistry';
import {
  scopeStorage,
  type CacheShards,
} from '#/apollo/offline/ApolloCachePersistence';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { Telemetry } from '#/services/telemetry';
import { logger } from '#/utils/environment';
import { isRecord } from '#/utils/isRecord';
import { useStore } from '#store';
import {
  ListFeed_ShardFragmentDoc,
  type ListFeed_ShardFragment,
} from './listFeed.generated';

const MEMBER_FIELDS = /^(itemsConnection|collaboratorsConnection)\b/;
const MEMBER_ROWS = /^(ShoppingListItem|ShoppingListCollaborator):/;

const listKey = (listId: string): string => `ShoppingList:${listId}`;

/** Lists whose stored copy is in memory, or has been replaced by a newer one. */
const hydrated = new Set<string>();
const shardBytes = new Map<string, number>();

const parentOf = (entity: unknown): unknown =>
  isRecord(entity) && isRecord(entity.shoppingList)
    ? entity.shoppingList.__ref
    : undefined;

/** The lists whose rows differ from what was last written. */
function changedLists(
  stored: NormalizedCacheObject,
  previous: NormalizedCacheObject | null,
): Set<unknown> {
  const changed = new Set<unknown>();
  for (const [key, entity] of Object.entries(stored)) {
    if (previous?.[key] === entity) continue;
    if (key.startsWith('ShoppingList:')) changed.add(key);
    else if (MEMBER_ROWS.test(key)) changed.add(parentOf(entity));
  }
  return changed;
}

/** What loads at launch: every list's own row, and no held list's members. */
function eagerPart(stored: NormalizedCacheObject): NormalizedCacheObject {
  const held = new Set([...heldScopes().keys()].map(listKey));
  const eager: NormalizedCacheObject = {};
  for (const [key, entity] of Object.entries(stored)) {
    if (MEMBER_ROWS.test(key) && held.has(String(parentOf(entity)))) continue;
    eager[key] =
      held.has(key) && entity
        ? Object.fromEntries(
            Object.entries(entity).filter(
              ([field]) => !MEMBER_FIELDS.test(field),
            ),
          )
        : entity;
  }
  return eager;
}

function writeShard(cache: ApolloCache, listId: string): void {
  const data = cache.readFragment({
    id: listKey(listId),
    fragment: ListFeed_ShardFragmentDoc,
    fragmentName: 'listFeed_shard',
    optimistic: false,
  });
  if (!data) {
    // The stored copy stands, and with no position the list is read in full.
    forgetPosition(listId);
    return;
  }
  const text = JSON.stringify(data);
  scopeStorage.write(listId, text);
  shardBytes.set(listId, text.length);
}

function restorePositions(): void {
  const text = scopeStorage.readPositions();
  if (!text) return;
  try {
    const stored = JSON.parse(text) as [string, FeedPosition][];
    for (const [listId, position] of stored) {
      // A position never outlives its rows: lost with them, the list reads in full.
      if (scopeStorage.has(listId)) holdPosition(listId, position);
    }
  } catch (error) {
    logger.warn('Lists: stored positions were unreadable', error);
    scopeStorage.writePositions('[]');
  }
}

/** Puts a stored list back in memory. A second call does nothing. */
export function hydrateListShard(cache: ApolloCache, listId: string): void {
  if (hydrated.has(listId)) return;
  hydrated.add(listId);
  const text = scopeStorage.read(listId);
  if (!text) return;
  try {
    cache.writeFragment({
      id: listKey(listId),
      fragment: ListFeed_ShardFragmentDoc,
      fragmentName: 'listFeed_shard',
      data: JSON.parse(text) as Unmasked<ListFeed_ShardFragment>,
      overwrite: true,
      // Called while rendering: the reader that asked sees it, and no other
      // component holds this list's rows.
      broadcast: false,
    });
    shardBytes.set(listId, text.length);
    pendingWritesOf(cache).scheduleRebuild();
  } catch (error) {
    logger.warn('Lists: a stored list was unreadable', error);
    discardListShard(listId);
  }
}

/** For a read that reaches into a list by id, from a hook with no cache of its own. */
export function holdListInMemory(listId: string): void {
  const client = getApolloClient();
  if (client) hydrateListShard(client.cache, listId);
}

/** The rows in memory are newer than any stored copy, which must not replace them. */
export const markListHydrated = (listId: string): void => {
  hydrated.add(listId);
};

export function discardListShard(listId: string): void {
  scopeStorage.remove(listId);
  shardBytes.delete(listId);
  hydrated.delete(listId);
  forgetPosition(listId);
}

/** @internal What a restart forgets, leaving the disk as it is. */
export function forgetShardMemory(): void {
  hydrated.clear();
  shardBytes.clear();
  clearPositions();
}

export const listShards: CacheShards = {
  save(cache, stored, previous) {
    const changed = changedLists(stored, previous);
    for (const listId of heldScopes().keys()) {
      // Only a list whose stored copy is in: a read of a cold list holds a
      // first page, which must not replace the whole list on disk.
      if (changed.has(listKey(listId)) && hydrated.has(listId)) {
        writeShard(cache, listId);
      }
    }
    // Last, so a position never reaches the disk ahead of its rows.
    scopeStorage.writePositions(JSON.stringify([...heldScopes()]));
    const bytes = [...shardBytes.values()].reduce((sum, n) => sum + n, 0);
    Telemetry.gauge('cache_persist_shard_kb', Math.round(bytes / 1024));
    return eagerPart(stored);
  },

  restore(cache) {
    restorePositions();
    const held = [...heldScopes().keys()];
    const { selectedShoppingListId: open } = useStore.getState();
    // A queued write can name a line of any list, and none says which.
    const hot =
      queueStore.getPendingWrites().length > 0
        ? held
        : held.filter(listId => listId === open);
    hot.forEach(listId => hydrateListShard(cache, listId));
  },

  clear() {
    scopeStorage.clear();
    forgetShardMemory();
  },
};
