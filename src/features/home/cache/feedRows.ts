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
  placeStorageLocation,
  unplaceStorageLocation,
} from '#features/catalog/cache/storageLocations';
import type { HomeFeedSnapshotQuery } from '../offline/homeFeed.generated';

type RowTypename =
  HomeFeedSnapshotQuery['syncSnapshot']['rows'][number]['__typename'];
const MEMBER: Extract<RowTypename, 'Membership'> = 'Membership';
const INVITE: Extract<RowTypename, 'HomeInvite'> = 'HomeInvite';
const LOCATION: Extract<RowTypename, 'StorageLocation'> = 'StorageLocation';
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

/** The locations the held pantries list, whichever variant lists them. */
function locationsInPantries(
  cache: ApolloCache,
  pantryIds: readonly string[],
): string[] {
  return pantryIds.flatMap(id =>
    idsListed(
      cache,
      cache.identify({ __typename: PANTRY, id }),
      'storageLocationsConnection',
    ),
  );
}

/**
 * Locations the summary listed for the home, into each held pantry of it. A
 * pantry's list is never dropped: the pantry screen reads it offline.
 */
export function listInHeldPantries(
  cache: ApolloCache,
  homeId: string,
  locationIds: readonly string[],
): void {
  if (locationIds.length === 0) return;
  const pantries = heldPantriesOf(cache, homeId);
  for (const id of locationIds) {
    placeStorageLocation(cache, id, homeId, pantries);
  }
}

const asRows = (typename: string, ids: readonly string[]) =>
  ids.map(id => ({ typename, id }));

/** Rows out of every list of the home that names them, then the cache in one sweep. */
function dropRows(
  cache: ApolloCache,
  homeId: string,
  pantryIds: readonly string[],
  { members, invites, locations }: HomeRows,
): void {
  for (const id of members) removeMember(cache, homeId, id);
  for (const id of invites) removeInvite(cache, homeId, id);
  for (const id of locations) unplaceStorageLocation(cache, id, pantryIds);
  const rows = [
    ...asRows(MEMBER, members),
    ...asRows(INVITE, invites),
    ...asRows(LOCATION, locations),
  ];
  if (rows.length > 0) safeEvictMany(cache, rows);
}

/** Members who left, invites that stopped pending and deleted locations. */
export function dropHomeRows(
  cache: ApolloCache,
  homeId: string,
  rows: HomeRows,
): void {
  const pantries =
    rows.locations.length > 0 ? heldPantriesOf(cache, homeId) : [];
  dropRows(cache, homeId, pantries, rows);
}

export const homeRowIds = ({ members, invites, locations }: HomeRows) => [
  ...members,
  ...invites,
  ...locations,
];

/**
 * Makes a home's rows the server's after a full read. What neither the read
 * nor the summary after it names leaves; a row only the summary names came
 * after the read, and the next pull brings it. `before` is what the lists
 * named before the summary rewrote them.
 */
export function replaceHomeRows(
  cache: ApolloCache,
  homeId: string,
  {
    read,
    listed,
    before,
  }: { read: HomeRows; listed: HomeRows; before: HomeRows },
): void {
  const pantries = heldPantriesOf(cache, homeId);
  const now = homeRowsHeld(cache, homeId);
  const kept = new Set([...homeRowIds(read), ...homeRowIds(listed)]);
  const gone = (...lists: (readonly string[])[]) =>
    [...new Set(lists.flat())].filter(id => !kept.has(id));
  dropRows(cache, homeId, pantries, {
    members: gone(before.members, now.members),
    invites: gone(before.invites, now.invites),
    locations: gone(
      before.locations,
      now.locations,
      locationsInPantries(cache, pantries),
    ),
  });
  for (const id of listed.locations) {
    placeStorageLocation(cache, id, homeId, pantries);
  }
}

/** Every row of a home the person has lost, and its location list. */
export function evictHomeRows(cache: ApolloCache, homeId: string): void {
  const pantries = heldPantriesOf(cache, homeId);
  const { members, invites, locations } = homeRowsHeld(cache, homeId);
  cache.evict({
    id: 'ROOT_QUERY',
    fieldName: 'storageLocations',
    args: { homeId },
  });
  dropRows(cache, homeId, pantries, {
    members,
    invites,
    locations: [
      ...new Set([...locations, ...locationsInPantries(cache, pantries)]),
    ],
  });
}
