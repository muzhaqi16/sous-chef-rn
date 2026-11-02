import type { ApolloCache, ApolloClient } from '@apollo/client';
import type {
  FeedAdapter,
  FeedAnswer,
  FeedPage,
  FeedScopeCursor,
  FeedSnapshot,
} from '#/apollo/feed/types';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import { SyncPageStatus, SyncScopeKind } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store';
import { removeCollaboratorFromShoppingListCache } from '../cache/collaborators';
import {
  dropShoppingListRows,
  moveAnsweredShoppingListItem,
  sortShoppingListRows,
} from '../cache/connections';
import {
  attachCollaborator,
  evictListRows,
  replaceListRows,
} from '../cache/feedRows';
import {
  addShoppingListToQueryCache,
  removeShoppingListFromCache,
} from '../cache/list';
import {
  discardListShard,
  hydrateListShard,
  markListHydrated,
} from './listShards';
import {
  ListFeedChangesDocument,
  ListFeedSnapshotDocument,
  type ListFeedChangesQuery,
  type ListFeedSnapshotQuery,
} from './listFeed.generated';

const SNAPSHOT_PAGE_SIZE = 100;

type ListPage = ListFeedChangesQuery['syncChanges'][number];
type SnapshotRow = ListFeedSnapshotQuery['syncSnapshot']['rows'][number];

function applyChanges(
  cache: ApolloCache,
  listId: string,
  page: ListPage,
): void {
  // Its rows join the stored ones, and the list is stored whole.
  hydrateListShard(cache, listId);
  for (const row of page.changed) {
    if (row.__typename === 'ShoppingListItem') {
      // The page states the list's totals, so this moves edges and counts nothing.
      const { isPurchased } = row.purchaseInfo;
      moveAnsweredShoppingListItem(cache, listId, row.id, isPurchased);
    } else if (row.__typename === 'ShoppingListCollaborator') {
      attachCollaborator(cache, listId, row.id);
    }
  }
  const removedLines = page.removed
    .filter(({ entityType }) => entityType === 'ShoppingListItem')
    .map(({ id }) => id);
  if (removedLines.length > 0) {
    dropShoppingListRows(cache, listId, removedLines);
  }
  for (const { entityType, id } of page.removed) {
    if (entityType === 'ShoppingListCollaborator') {
      removeCollaboratorFromShoppingListCache(cache, listId, id, {
        evictItem: true,
      });
    }
  }
  sortShoppingListRows(cache, listId);
}

const readSnapshotPage = (
  client: ApolloClient,
  id: string,
  after: string | null,
) =>
  client.query({
    query: ListFeedSnapshotDocument,
    variables: {
      input: {
        kind: SyncScopeKind.ShoppingList,
        id,
        first: SNAPSHOT_PAGE_SIZE,
        after,
      },
    },
    fetchPolicy: 'network-only',
  });

interface FullRead {
  status: SyncPageStatus;
  cursor: string | null;
  rows: SnapshotRow[];
}

async function readAllRows(
  client: ApolloClient,
  id: string,
): Promise<FeedAnswer<FullRead>> {
  const rows: SnapshotRow[] = [];
  let cursor: string | null = null;
  let after: string | null = null;
  let hasMore = true;
  while (hasMore) {
    const { data, error }: Awaited<ReturnType<typeof readSnapshotPage>> =
      await readSnapshotPage(client, id, after);
    if (error || !data) return { error };
    const page = data.syncSnapshot;
    if (page.status !== SyncPageStatus.Current) {
      return { data: { status: page.status, cursor: null, rows: [] } };
    }
    // Later pages answer none: the first page's was taken before any row.
    cursor ??= page.cursor ?? null;
    rows.push(...page.rows);
    ({ hasMore } = page);
    after = page.endCursor ?? null;
    if (hasMore && !after)
      return { error: new Error('Snapshot lost its place') };
  }
  return { data: { status: SyncPageStatus.Current, cursor, rows } };
}

function replacing(
  listId: string,
  rows: readonly SnapshotRow[],
  gained: boolean,
): FeedSnapshot['replace'] {
  return cache => {
    const open: string[] = [];
    const purchased: string[] = [];
    const collaborators: string[] = [];
    for (const row of rows) {
      switch (row.__typename) {
        case 'ShoppingListItem':
          (row.purchaseInfo.isPurchased ? purchased : open).push(row.id);
          break;
        case 'ShoppingListCollaborator':
          collaborators.push(row.id);
          break;
        case 'ShoppingList':
          if (gained && !row.isTemplate) {
            addShoppingListToQueryCache(cache, {
              __typename: row.__typename,
              id: row.id,
              homeId: row.homeId ?? null,
            });
          }
          break;
        default:
          // A row type a newer server added.
          break;
      }
    }
    markListHydrated(listId);
    replaceListRows(cache, listId, { open, purchased, collaborators });
  };
}

export const listFeedAdapter: FeedAdapter = {
  kind: SyncScopeKind.ShoppingList,

  async pull(client, scopes: readonly FeedScopeCursor[]) {
    const { data, error } = await client.query({
      query: ListFeedChangesDocument,
      variables: {
        input: {
          scopes: scopes.map(({ id, cursor }) => ({
            kind: SyncScopeKind.ShoppingList,
            id,
            cursor,
          })),
        },
      },
      fetchPolicy: 'network-only',
    });
    if (error || !data) return { error };
    const pages: FeedPage[] = data.syncChanges.map(page => ({
      scopeId: page.scope.id,
      status: page.status,
      cursor: page.cursor ?? null,
      hasMore: page.hasMore,
      applied: page.applied,
      apply: cache => applyChanges(cache, page.scope.id, page),
    }));
    return { data: pages };
  },

  async snapshot(client, id) {
    const gained = !isHeld(client.cache, { __typename: 'ShoppingList', id });
    const answer = await readAllRows(client, id);
    if (answer.data === undefined) return answer;
    const { status, cursor, rows } = answer.data;
    return { data: { status, cursor, replace: replacing(id, rows, gained) } };
  },

  evict(cache, id) {
    removeShoppingListFromCache(cache, id);
    evictListRows(cache, id);
    discardListShard(id);
  },

  holdsUnacknowledgedCreate: id => queueStore.holdsCreateFor(id),

  isOnScreen: id => useStore.getState().selectedShoppingListId === id,
};
