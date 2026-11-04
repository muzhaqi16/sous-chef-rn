import type { ApolloCache, ApolloClient } from '@apollo/client';
import type {
  FeedAdapter,
  FeedAnswer,
  FeedPage,
  FeedSnapshot,
} from '#/apollo/feed/types';
import { readWholeScope } from '#/apollo/feed/readWholeScope';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import { dropHome } from '#/domain/dropHome';
import { SyncPageStatus, SyncScopeKind } from '#/graphql/generated/schemaTypes';
import { logger } from '#/utils/environment';
import { useStore } from '#store';
import {
  dropHomeRows,
  dropOrderedMembers,
  evictHomeRows,
  homeRowIds,
  homeRowsHeld,
  listInHeldPantries,
  replaceHomeRows,
  type HomeRows,
} from '../cache/feedRows';
import { addToHomesCache } from '../hooks/homeCacheUpdaters';
import {
  HomeFeedChangesDocument,
  HomeFeedSnapshotDocument,
  HomeFeedSummaryDocument,
  HomeFeed_JoinFragmentDoc,
  type HomeFeedChangesQuery,
  type HomeFeedSnapshotQuery,
} from './homeFeed.generated';

const SNAPSHOT_PAGE_SIZE = 100;

type HomePage = HomeFeedChangesQuery['syncChanges'][number];
type SnapshotRow = HomeFeedSnapshotQuery['syncSnapshot']['rows'][number];

/** A home's rows sorted by what lists them; the home's own row is in none. */
function scopeRowsOf(rows: readonly SnapshotRow[]): HomeRows {
  const sorted: HomeRows = { members: [], invites: [], locations: [] };
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

const NO_ROWS: HomeRows = { members: [], invites: [], locations: [] };

/** What a page needs read once applied. */
interface PageFollowUp {
  /** Locations the home did not list yet, for the summary to complete. */
  newLocations: string[];
}

/** The join code and switch a home held before a pull wrote over them. */
function joinOf(cache: ApolloCache, homeId: string): string | null {
  const join = cache.readFragment({
    id: cache.identify({ __typename: 'Home', id: homeId }),
    fragment: HomeFeed_JoinFragmentDoc,
    optimistic: false,
  });
  return join ? `${String(join.allowJoinCode)}:${join.joinCode ?? ''}` : null;
}

/**
 * Takes out what a page removed. A page holding a member, an invite or a
 * location, or moving what a held join link is made of, needs the summary;
 * else null, and nothing is read.
 */
function applyChanges(
  cache: ApolloCache,
  homeId: string,
  page: HomePage,
  joinBefore: string | null,
): PageFollowUp | null {
  const held = homeRowsHeld(cache, homeId);
  const changed = scopeRowsOf(page.changed);
  const removed: HomeRows = { members: [], invites: [], locations: [] };
  for (const { entityType, id } of page.removed) {
    if (entityType === 'Membership') removed.members.push(id);
    else if (entityType === 'HomeInvite') removed.invites.push(id);
    else if (entityType === 'StorageLocation') removed.locations.push(id);
  }
  dropHomeRows(cache, homeId, removed);
  if (changed.members.some(id => !held.members.includes(id))) {
    dropOrderedMembers(cache, homeId);
  }
  const joinMoved =
    joinBefore !== null &&
    page.changed.some(row => row.__typename === 'Home') &&
    joinOf(cache, homeId) !== joinBefore;
  const touched = homeRowIds(changed).length + homeRowIds(removed).length > 0;
  return touched || joinMoved
    ? {
        newLocations: changed.locations.filter(
          id => !held.locations.includes(id),
        ),
      }
    : null;
}

/**
 * The values and people a pull leaves out, and the lists a new row joins;
 * answers the rows the summary listed. A failure keeps the server's error, so
 * a refusal's wait still paces the engine.
 */
async function readSummary(
  client: ApolloClient,
  homeId: string,
): Promise<FeedAnswer<HomeRows>> {
  const { data, error } = await client.query({
    query: HomeFeedSummaryDocument,
    variables: { id: homeId },
    fetchPolicy: 'network-only',
  });
  if (error || !data?.home) {
    logger.warn('Home feed: the summary was not read', error);
    return {
      error: error ?? new Error('Home feed: the home was not answered'),
    };
  }
  const idsOf = (connection: { edges: { node: { id: string } }[] }) =>
    connection.edges.map(({ node }) => node.id);
  return {
    data: {
      members: idsOf(data.home.membersConnection),
      invites: idsOf(data.home.invitesConnection),
      locations: idsOf(data.storageLocations),
    },
  };
}

/**
 * A new row joins its lists only through the summary, which reads it whole.
 * Unread, the engine reads the home in full next, as its rows are not complete.
 */
async function completeAfterPull(
  client: ApolloClient,
  homeId: string,
  { newLocations }: PageFollowUp,
): Promise<FeedAnswer<true>> {
  const summary = await readSummary(client, homeId);
  if (summary.data === undefined) return summary;
  const listed = new Set(summary.data.locations);
  listInHeldPantries(
    client.cache,
    homeId,
    newLocations.filter(id => listed.has(id)),
  );
  return { data: true };
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

/** A home read in full is the person's, so the homes list names it. */
function replacing(
  homeId: string,
  rows: readonly SnapshotRow[],
  listed: HomeRows,
  before: HomeRows,
): FeedSnapshot['replace'] {
  const read = scopeRowsOf(rows);
  return cache => {
    replaceHomeRows(cache, homeId, { read, listed, before });
    addToHomesCache(
      cache,
      { __typename: 'Home', id: homeId },
      { position: 'end' },
    );
  };
}

export const homeFeedAdapter: FeedAdapter = {
  kind: SyncScopeKind.Home,

  async pull(client, scopes) {
    // The answer's rows are in the cache once it lands.
    const joinBefore = new Map(
      scopes.map(({ id }) => [id, joinOf(client.cache, id)]),
    );
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
      let followUp: PageFollowUp | null = null;
      return {
        scopeId: page.scope.id,
        status: page.status,
        cursor: page.cursor ?? null,
        hasMore: page.hasMore,
        applied: page.applied,
        apply: cache => {
          followUp = applyChanges(
            cache,
            page.scope.id,
            page,
            joinBefore.get(page.scope.id) ?? null,
          );
        },
        afterApply: () =>
          followUp
            ? completeAfterPull(client, page.scope.id, followUp)
            : Promise.resolve({ data: true }),
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
    const before = homeRowsHeld(client.cache, id);
    let listed = NO_ROWS;
    if (status === SyncPageStatus.Current) {
      const summary = await readSummary(client, id);
      if (summary.data === undefined) return summary;
      listed = summary.data;
    }
    return {
      data: { status, cursor, replace: replacing(id, rows, listed, before) },
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
