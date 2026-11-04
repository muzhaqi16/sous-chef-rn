import type { ApolloCache } from '@apollo/client';
import {
  createRemoveFromParentConnectionUpdater,
  isUnfilteredVariant,
  safeEvictMany,
  skipUnmatchedArgVariants,
  type ConnectionData,
} from '#/apollo/utils/cacheUpdaters';
import type { Pantry } from '#/graphql/generated/schemaTypes';
import { isRecord } from '#/utils/isRecord';
import {
  dropStorageLocation,
  placeStorageLocation,
} from '#features/catalog/cache/storageLocations';
import type { HomeFeedSnapshotQuery } from '../offline/homeFeed.generated';

type RowTypename =
  HomeFeedSnapshotQuery['syncSnapshot']['rows'][number]['__typename'];
const MEMBER: Extract<RowTypename, 'Membership'> = 'Membership';
const INVITE: Extract<RowTypename, 'HomeInvite'> = 'HomeInvite';
const PANTRY: NonNullable<Pantry['__typename']> = 'Pantry';

const removeMember = createRemoveFromParentConnectionUpdater(
  'Home',
  'membersConnection',
  MEMBER,
);
const removeInvite = createRemoveFromParentConnectionUpdater(
  'Home',
  'invitesConnection',
  INVITE,
);

const skipOrdered = (storeFieldName: string): boolean =>
  !isUnfilteredVariant(storeFieldName);

/** The ids a home's lists of one kind hold, whichever variant lists them. */
function idsListed(
  cache: ApolloCache,
  id: string | undefined,
  field: string,
  skip: (storeFieldName: string) => boolean = () => false,
): string[] {
  const ids = new Set<string>();
  if (!id) return [];
  cache.modify({
    id,
    fields: {
      [field](
        existing: ConnectionData | undefined,
        { readField, storeFieldName },
      ) {
        if (!skip(storeFieldName)) {
          for (const edge of existing?.edges ?? []) {
            const nodeId = readField<string>('id', edge.node);
            if (nodeId) ids.add(nodeId);
          }
        }
        return existing;
      },
    },
  });
  return [...ids];
}

const homeRef = (cache: ApolloCache, homeId: string) =>
  cache.identify({ __typename: 'Home', id: homeId });

/** The pantries of a home the device holds, whose location lists name its locations. */
function heldPantriesOf(cache: ApolloCache, homeId: string): string[] {
  const stored: unknown = cache.extract(false);
  if (!isRecord(stored)) return [];
  return Object.values(stored).flatMap((entity: unknown) =>
    isRecord(entity) &&
    entity.__typename === PANTRY &&
    entity.homeId === homeId &&
    typeof entity.id === 'string'
      ? [entity.id]
      : [],
  );
}

/** The members, invites and locations the device lists for a home. */
export interface HomeRows {
  members: string[];
  invites: string[];
  locations: string[];
}

export function homeRowsHeld(cache: ApolloCache, homeId: string): HomeRows {
  const home = homeRef(cache, homeId);
  return {
    members: idsListed(cache, home, 'membersConnection'),
    invites: idsListed(cache, home, 'invitesConnection'),
    locations: idsListed(
      cache,
      'ROOT_QUERY',
      'storageLocations',
      skipUnmatchedArgVariants({ homeId }),
    ),
  };
}

/** Every list of a home's members in another order, read again when next asked. */
export function dropOrderedMembers(cache: ApolloCache, homeId: string): void {
  const id = homeRef(cache, homeId);
  if (!id) return;
  cache.modify({
    id,
    fields: {
      membersConnection(existing: unknown, { storeFieldName, DELETE }) {
        return skipOrdered(storeFieldName) ? DELETE : existing;
      },
    },
  });
}

/**
 * Locations the summary read listed for the home, into each held pantry of
 * it. A pantry's list is never dropped: the pantry screen reads it offline.
 */
export function listInHeldPantries(
  cache: ApolloCache,
  homeId: string,
  locationIds: readonly string[],
): void {
  const pantries = heldPantriesOf(cache, homeId);
  for (const id of locationIds) {
    placeStorageLocation(cache, id, homeId, pantries);
  }
}

/** A member who left, out of every list of the home's members and the cache. */
export function dropMember(
  cache: ApolloCache,
  homeId: string,
  membershipId: string,
): void {
  removeMember(cache, homeId, membershipId, { evictItem: true });
}

/** An invite that stopped pending, out of the home's invites and the cache. */
export function dropInvite(
  cache: ApolloCache,
  homeId: string,
  inviteId: string,
): void {
  removeInvite(cache, homeId, inviteId, { evictItem: true });
}

export function dropLocation(
  cache: ApolloCache,
  homeId: string,
  locationId: string,
): void {
  dropStorageLocation(cache, locationId, heldPantriesOf(cache, homeId));
}

/**
 * Makes a home's members, invites and locations no more than a full read
 * holds: what it does not hold leaves. The summary read rewrote the lists
 * first, so what they named before it is passed in as `before`.
 */
export function keepHomeRows(
  cache: ApolloCache,
  homeId: string,
  read: ReadonlySet<string>,
  before: HomeRows,
): void {
  const now = homeRowsHeld(cache, homeId);
  const gone = (ids: readonly string[], more: readonly string[]) =>
    [...new Set([...ids, ...more])].filter(id => !read.has(id));
  for (const id of gone(before.members, now.members)) {
    dropMember(cache, homeId, id);
  }
  for (const id of gone(before.invites, now.invites)) {
    dropInvite(cache, homeId, id);
  }
  for (const id of gone(before.locations, now.locations)) {
    dropLocation(cache, homeId, id);
  }
}

/** Every row of a home the person has lost, and its location list. */
export function evictHomeRows(cache: ApolloCache, homeId: string): void {
  const { members, invites, locations } = homeRowsHeld(cache, homeId);
  const pantries = heldPantriesOf(cache, homeId);
  for (const id of locations) dropStorageLocation(cache, id, pantries);
  cache.evict({
    id: 'ROOT_QUERY',
    fieldName: 'storageLocations',
    args: { homeId },
  });
  safeEvictMany(cache, [
    ...members.map(id => ({ typename: MEMBER, id })),
    ...invites.map(id => ({ typename: INVITE, id })),
  ]);
}
