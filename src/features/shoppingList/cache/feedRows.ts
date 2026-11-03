import type { ApolloCache } from '@apollo/client';
import { safeEvict, safeEvictMany } from '#/apollo/utils/cacheUpdaters';
import type { ConnectionData } from '#/apollo/utils/cacheUpdaters';
import { isRecord } from '#/utils/isRecord';
import {
  ListFeed_CollaboratorsFragmentDoc,
  ListFeed_ItemsFragmentDoc,
  type ListFeed_CollaboratorsFragment,
  type ListFeed_ItemsFragment,
  type ListFeedSnapshotQuery,
} from '../offline/listFeed.generated';

type ListRow = ListFeedSnapshotQuery['syncSnapshot']['rows'][number];
type ItemEdge = ListFeed_ItemsFragment['itemsConnection']['edges'][number];
type CollaboratorEdge =
  ListFeed_CollaboratorsFragment['collaboratorsConnection']['edges'][number];

const WHOLE_PAGE: ListFeed_ItemsFragment['itemsConnection']['pageInfo'] = {
  __typename: 'PageInfo',
  hasNextPage: false,
  endCursor: null,
};

const ROW_TYPENAMES: ReadonlySet<unknown> = new Set<
  Exclude<ListRow['__typename'], 'ShoppingList'>
>(['ShoppingListItem', 'ShoppingListCollaborator']);

/** The rows a scan finds on a list, as by-id root fields pin them past `gc()`. */
export function listRowsHeld(
  cache: ApolloCache,
  listId: string,
): { typename: string; id: string }[] {
  const listRef = cache.identify({ __typename: 'ShoppingList', id: listId });
  const stored: unknown = cache.extract(false);
  if (!isRecord(stored)) return [];
  return Object.values(stored).flatMap((entity: unknown) => {
    if (!isRecord(entity) || !isRecord(entity.shoppingList)) return [];
    const { __typename: typename, id } = entity;
    return entity.shoppingList.__ref === listRef &&
      typeof typename === 'string' &&
      ROW_TYPENAMES.has(typename) &&
      typeof id === 'string'
      ? [{ typename, id }]
      : [];
  });
}

/** Writes one `itemsConnection` variant whole, past the merge keeping a tail. */
function writeItemsVariant(
  cache: ApolloCache,
  listId: string,
  isPurchased: boolean,
  ids: readonly string[],
): void {
  cache.writeFragment({
    id: cache.identify({ __typename: 'ShoppingList', id: listId }),
    fragment: ListFeed_ItemsFragmentDoc,
    fragmentName: 'listFeed_items',
    variables: { isPurchased },
    overwrite: true,
    data: {
      __typename: 'ShoppingList',
      id: listId,
      itemsConnection: {
        __typename: 'ShoppingListItemConnection',
        totalCount: ids.length,
        pageInfo: WHOLE_PAGE,
        edges: ids.map(
          (id): ItemEdge => ({
            __typename: 'ShoppingListItemEdge',
            cursor: id,
            node: { __typename: 'ShoppingListItem', id },
          }),
        ),
      },
    },
  });
}

function writeCollaborators(
  cache: ApolloCache,
  listId: string,
  ids: readonly string[],
): void {
  cache.writeFragment({
    id: cache.identify({ __typename: 'ShoppingList', id: listId }),
    fragment: ListFeed_CollaboratorsFragmentDoc,
    fragmentName: 'listFeed_collaborators',
    overwrite: true,
    data: {
      __typename: 'ShoppingList',
      id: listId,
      collaboratorsConnection: {
        __typename: 'ShoppingListCollaboratorConnection',
        totalCount: ids.length,
        pageInfo: WHOLE_PAGE,
        edges: ids.map(
          (id): CollaboratorEdge => ({
            __typename: 'ShoppingListCollaboratorEdge',
            cursor: id,
            node: { __typename: 'ShoppingListCollaborator', id },
          }),
        ),
      },
    },
  });
}

/**
 * Makes a list's server rows exactly these. A row a full read does not hold
 * leaves, and a pending write's layer stays above all of it.
 */
export function replaceListRows(
  cache: ApolloCache,
  listId: string,
  rows: {
    open: readonly string[];
    purchased: readonly string[];
    collaborators: readonly string[];
  },
): void {
  const kept = new Set([
    ...rows.open,
    ...rows.purchased,
    ...rows.collaborators,
  ]);
  const stale = listRowsHeld(cache, listId).filter(({ id }) => !kept.has(id));
  writeItemsVariant(cache, listId, false, rows.open);
  writeItemsVariant(cache, listId, true, rows.purchased);
  writeCollaborators(cache, listId, rows.collaborators);
  if (stale.length > 0) safeEvictMany(cache, stale);
}

/** Adds a collaborator the feed reported; a list with none cached takes it at its next read. */
export function attachCollaborator(
  cache: ApolloCache,
  listId: string,
  id: string,
): void {
  cache.modify({
    id: cache.identify({ __typename: 'ShoppingList', id: listId }),
    fields: {
      collaboratorsConnection(
        existing: ConnectionData | undefined,
        { readField, toReference },
      ) {
        if (!existing?.edges) return existing;
        const held = existing.edges.some(
          edge => readField<string>('id', edge.node) === id,
        );
        const node = toReference({
          __typename: 'ShoppingListCollaborator',
          id,
        });
        if (held || !node) return existing;
        return {
          ...existing,
          edges: [
            ...existing.edges,
            { __typename: 'ShoppingListCollaboratorEdge', cursor: id, node },
          ],
          totalCount: (existing.totalCount ?? 0) + 1,
        };
      },
    },
  });
}

/** A list and everything on it, a row scan finding what by-id fields pin. */
export function evictListRows(cache: ApolloCache, listId: string): void {
  safeEvictMany(cache, listRowsHeld(cache, listId));
  cache.evict({
    id: 'ROOT_QUERY',
    fieldName: 'shoppingList',
    args: { id: listId },
  });
  safeEvict(cache, 'ShoppingList', listId);
}
