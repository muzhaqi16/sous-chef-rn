import type { ApolloCache, ApolloClient } from '@apollo/client';
import { forgetPosition } from '#/apollo/feed/feedPositions';
import type { FeedAdapter, FeedPage, FeedSnapshot } from '#/apollo/feed/types';
import { readWholeScope } from '#/apollo/feed/readWholeScope';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import { dropHome } from '#/domain/dropHome';
import { SyncPageStatus, SyncScopeKind } from '#/graphql/generated/schemaTypes';
import { logger } from '#/utils/environment';
import { useStore } from '#store';
import {
  dropInvite,
  dropLocation,
  dropMember,
  dropOrderedMembers,
  evictHomeRows,
  homeRowsHeld,
  keepHomeRows,
  listInHeldPantries,
  type HomeRows,
} from '../cache/feedRows';
import { addToHomesCache } from '../hooks/homeCacheUpdaters';
import {
  HomeFeedChangesDocument,
  HomeFeedSnapshotDocument,
  HomeFeedSummaryDocument,
  type HomeFeedChangesQuery,
  type HomeFeedSnapshotQuery,
} from './homeFeed.generated';

const SNAPSHOT_PAGE_SIZE = 100;

type HomePage = HomeFeedChangesQuery['syncChanges'][number];
type SnapshotRow = HomeFeedSnapshotQuery['syncSnapshot']['rows'][number];

/** A home's rows sorted by what lists them; the home's own row is in none. */
interface ScopeRows {
  members: string[];
  invites: string[];
  locations: string[];
}

function scopeRowsOf(rows: readonly SnapshotRow[]): ScopeRows {
  const sorted: ScopeRows = { members: [], invites: [], locations: [] };
  for (const row of rows) {
    switch (row.__typename) {
      case 'Membership':
        sorted.members.push(row.id);
        break;
      case 'HomeInvite':
        sorted.invites.push(row.id);
        break;
      case 'StorageLocation':
        sorted.locations.push(row.id);
        break;
      // This feed asks for homes, so another kind's rows reach only its own.
      case 'Home':
      case 'Pantry':
      case 'PantryItem':
      case 'PantryItemBatch':
      case 'PantryItemUsage':
      case 'ShoppingList':
      case 'ShoppingListItem':
      case 'ShoppingListCollaborator':
      default:
        // A row type a newer server added.
        break;
    }
  }
  return sorted;
}

/**
 * Takes out what a page removed. A page holding a member, an invite or a
 * location answers the locations its home did not list yet, for the summary
 * to complete; else null, and nothing is read.
 */
function applyChanges(
  cache: ApolloCache,
  homeId: string,
  page: HomePage,
): string[] | null {
  const held = homeRowsHeld(cache, homeId);
  const changed = scopeRowsOf(page.changed);
  let touched =
    changed.members.length + changed.invites.length + changed.locations.length >
    0;
  for (const { entityType, id } of page.removed) {
    if (entityType === 'Membership') dropMember(cache, homeId, id);
    else if (entityType === 'HomeInvite') dropInvite(cache, homeId, id);
    else if (entityType === 'StorageLocation') dropLocation(cache, homeId, id);
    else continue;
    touched = true;
  }
  if (changed.members.some(id => !held.members.includes(id))) {
    dropOrderedMembers(cache, homeId);
  }
  return touched
    ? changed.locations.filter(id => !held.locations.includes(id))
    : null;
}

/** The values and people a pull leaves out, and the lists a new row joins. */
async function readSummary(
  client: ApolloClient,
  homeId: string,
): Promise<boolean> {
  const { data, error } = await client.query({
    query: HomeFeedSummaryDocument,
    variables: { id: homeId },
    fetchPolicy: 'network-only',
  });
  if (error || !data) {
    logger.warn('Home feed: the summary was not read', error);
    return false;
  }
  return true;
}

/**
 * A new row joins its lists only through the summary, which reads it whole.
 * Unread, the home is read in full next pass, as its rows are not complete.
 */
async function completeAfterPull(
  client: ApolloClient,
  homeId: string,
  newLocations: readonly string[],
): Promise<void> {
  if (!(await readSummary(client, homeId))) {
    forgetPosition(homeId);
    return;
  }
  listInHeldPantries(client.cache, homeId, newLocations);
}

const readSnapshotPage = (
  client: ApolloClient,
  id: string,
  after: string | null,
) =>
  client.query({
    query: HomeFeedSnapshotDocument,
    variables: {
      input: { kind: SyncScopeKind.Home, id, first: SNAPSHOT_PAGE_SIZE, after },
    },
    fetchPolicy: 'network-only',
  });

function replacing(
  homeId: string,
  rows: readonly SnapshotRow[],
  gained: boolean,
  before: HomeRows,
): FeedSnapshot['replace'] {
  const { members, invites, locations } = scopeRowsOf(rows);
  return cache => {
    keepHomeRows(
      cache,
      homeId,
      new Set([...members, ...invites, ...locations]),
      before,
    );
    listInHeldPantries(cache, homeId, locations);
    if (gained) {
      addToHomesCache(
        cache,
        { __typename: 'Home', id: homeId },
        { position: 'end' },
      );
    }
  };
}

export const homeFeedAdapter: FeedAdapter = {
  kind: SyncScopeKind.Home,

  async pull(client, scopes) {
    const { data, error } = await client.query({
      query: HomeFeedChangesDocument,
      variables: {
        input: {
          scopes: scopes.map(({ id, cursor }) => ({
            kind: SyncScopeKind.Home,
            id,
            cursor,
          })),
        },
      },
      fetchPolicy: 'network-only',
    });
    if (error || !data) return { error };
    const pages: FeedPage[] = data.syncChanges.map(page => {
      let newLocations: string[] | null = null;
      return {
        scopeId: page.scope.id,
        status: page.status,
        cursor: page.cursor ?? null,
        hasMore: page.hasMore,
        applied: page.applied,
        apply: cache => {
          newLocations = applyChanges(cache, page.scope.id, page);
        },
        afterApply: () =>
          newLocations
            ? completeAfterPull(client, page.scope.id, newLocations)
            : Promise.resolve(),
      };
    });
    return { data: pages };
  },

  async snapshot(client, id) {
    const gained = !isHeld(client.cache, { __typename: 'Home', id });
    const answer = await readWholeScope(after =>
      readSnapshotPage(client, id, after),
    );
    if (answer.data === undefined) return answer;
    const { status, cursor, rows } = answer.data;
    const before = homeRowsHeld(client.cache, id);
    if (status === SyncPageStatus.Current && !(await readSummary(client, id))) {
      return { error: new Error('Home feed: the summary was not read') };
    }
    return {
      data: { status, cursor, replace: replacing(id, rows, gained, before) },
    };
  },

  evict(cache, id) {
    evictHomeRows(cache, id);
    dropHome(cache, id);
  },

  holdsUnacknowledgedCreate: id => queueStore.holdsCreateFor(id),

  isOnScreen: id => useStore.getState().selectedHomeId === id,

  // A home is tens of rows, which load at launch with its own.
  holdsStoredRows: (cache, id) => isHeld(cache, { __typename: 'Home', id }),
};
