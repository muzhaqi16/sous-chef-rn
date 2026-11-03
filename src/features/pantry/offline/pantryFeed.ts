import type { ApolloCache, ApolloClient } from '@apollo/client';
import type { FeedAdapter, FeedPage, FeedSnapshot } from '#/apollo/feed/types';
import { readWholeScope } from '#/apollo/feed/readWholeScope';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { SyncScopeKind } from '#/graphql/generated/schemaTypes';
import { todayKey } from '#/utils/dateUtils';
import { logger } from '#/utils/environment';
import { useStore } from '#store';
import {
  dropPantryBatch,
  dropPantryStack,
  dropServerLists,
  evictPantryRows,
  placePantryBatch,
  placePantryStack,
  replacePantryStacks,
} from '../cache/feedRows';
import {
  PantryFeedChangesDocument,
  PantryFeedSnapshotDocument,
  PantryFeedSummaryDocument,
  type PantryFeedChangesQuery,
  type PantryFeedSnapshotQuery,
} from './pantryFeed.generated';

const SNAPSHOT_PAGE_SIZE = 100;

type PantryPage = PantryFeedChangesQuery['syncChanges'][number];
type SnapshotRow = PantryFeedSnapshotQuery['syncSnapshot']['rows'][number];

/** Places a page's rows. True when it moved what the pantry's counts count. */
function applyChanges(
  cache: ApolloCache,
  pantryId: string,
  page: PantryPage,
): boolean {
  let moved = false;
  for (const row of page.changed) {
    if (row.__typename === 'PantryItem') {
      placePantryStack(cache, pantryId, row.id);
      moved = true;
    } else if (row.__typename === 'PantryItemBatch') {
      placePantryBatch(cache, row.pantryItemId, row.id);
      moved = true;
    }
  }
  for (const { entityType, id } of page.removed) {
    if (entityType === 'PantryItem') {
      dropPantryStack(cache, pantryId, id);
      moved = true;
    } else if (entityType === 'PantryItemBatch') {
      dropPantryBatch(cache, id);
      moved = true;
    } else if (entityType === 'PantryItemUsage') {
      // Left out of the pull, so only one a read placed is here to go.
      safeEvict(cache, 'PantryItemUsage', id);
    }
  }
  if (moved) dropServerLists(cache, pantryId);
  return moved;
}

/** The counts are computed on read, so a pull leaves them for this. */
async function readSummaryAgain(
  client: ApolloClient,
  pantryId: string,
): Promise<void> {
  const { error } = await client.query({
    query: PantryFeedSummaryDocument,
    variables: { id: pantryId, today: todayKey() },
    fetchPolicy: 'network-only',
  });
  if (error) logger.warn('Pantry feed: the summary was not read', error);
}

const readSnapshotPage = (
  client: ApolloClient,
  id: string,
  after: string | null,
) =>
  client.query({
    query: PantryFeedSnapshotDocument,
    variables: {
      input: {
        kind: SyncScopeKind.Pantry,
        id,
        first: SNAPSHOT_PAGE_SIZE,
        after,
      },
      today: todayKey(),
    },
    fetchPolicy: 'network-only',
  });

function replacing(
  pantryId: string,
  rows: readonly SnapshotRow[],
): FeedSnapshot['replace'] {
  return cache => {
    const stacks: string[] = [];
    for (const row of rows) {
      switch (row.__typename) {
        case 'PantryItem':
          stacks.push(row.id);
          break;
        // A batch is written by the read, and its page read again. This feed
        // asks for pantries, so a list's rows reach only its own.
        case 'PantryItemBatch':
        case 'Pantry':
        case 'PantryItemUsage':
        case 'ShoppingList':
        case 'ShoppingListItem':
        case 'ShoppingListCollaborator':
        default:
          // A row type a newer server added.
          break;
      }
    }
    replacePantryStacks(cache, pantryId, stacks);
  };
}

export const pantryFeedAdapter: FeedAdapter = {
  kind: SyncScopeKind.Pantry,

  async pull(client, scopes) {
    const { data, error } = await client.query({
      query: PantryFeedChangesDocument,
      variables: {
        input: {
          scopes: scopes.map(({ id, cursor }) => ({
            kind: SyncScopeKind.Pantry,
            id,
            cursor,
          })),
        },
      },
      fetchPolicy: 'network-only',
    });
    if (error || !data) return { error };
    const pages: FeedPage[] = data.syncChanges.map(page => {
      let moved = false;
      return {
        scopeId: page.scope.id,
        status: page.status,
        cursor: page.cursor ?? null,
        hasMore: page.hasMore,
        applied: page.applied,
        apply: cache => {
          moved = applyChanges(cache, page.scope.id, page);
        },
        afterApply: () =>
          moved ? readSummaryAgain(client, page.scope.id) : Promise.resolve(),
      };
    });
    return { data: pages };
  },

  async snapshot(client, id) {
    const answer = await readWholeScope(after =>
      readSnapshotPage(client, id, after),
    );
    if (answer.data === undefined) return answer;
    const { status, cursor, rows } = answer.data;
    return { data: { status, cursor, replace: replacing(id, rows) } };
  },

  evict: evictPantryRows,

  holdsUnacknowledgedCreate: id => queueStore.holdsCreateFor(id),

  isOnScreen: id => useStore.getState().selectedPantryId === id,

  // Its rows load at launch, so the pantry's own row says they came back.
  holdsStoredRows: (cache, id) => isHeld(cache, { __typename: 'Pantry', id }),
};
