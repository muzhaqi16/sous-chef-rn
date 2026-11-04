import { gql, type ApolloCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { seedFragment, seedQuery } from '#/test-utils/apolloMockProvider';
import { GetStorageLocationsDocument } from '#features/catalog/graphql/storageLocation.generated';
import {
  dropInvite,
  dropLocation,
  dropMember,
  dropOrderedMembers,
  evictHomeRows,
  homeRowsHeld,
  keepHomeRows,
  listInHeldPantries,
} from '../feedRows';

const HOME = 'home-1';
const OTHER_HOME = 'home-2';
const PANTRY = 'pantry-1';

const MEMBERS = gql`
  fragment TestHomeMembers on Home {
    id
    membersConnection(first: 20) {
      totalCount
      edges {
        node {
          id
        }
      }
    }
  }
`;

const OLDEST_MEMBERS = gql`
  fragment TestOldestMembers on Home {
    id
    membersConnection(first: 20, orderBy: { createdAt: ASC }) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

const INVITES = gql`
  fragment TestHomeInvites on Home {
    id
    invitesConnection(first: 20) {
      totalCount
      edges {
        node {
          id
        }
      }
    }
  }
`;

const PANTRY_LOCATIONS = gql`
  fragment TestPantryLocations on Pantry {
    id
    homeId
    storageLocationsConnection(first: 20) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

const nodes = <Typename extends string>(
  ids: readonly string[],
  typename: Typename,
) => ids.map(id => ({ node: { __typename: typename, id } }));

function seedHome(
  cache: ApolloCache,
  {
    members = [],
    invites = [],
  }: { members?: string[]; invites?: string[] } = {},
): void {
  seedFragment(cache, {
    id: `Home:${HOME}`,
    fragment: MEMBERS,
    data: {
      __typename: 'Home',
      id: HOME,
      membersConnection: {
        totalCount: members.length,
        edges: nodes(members, 'Membership'),
      },
    },
  });
  seedFragment(cache, {
    id: `Home:${HOME}`,
    fragment: INVITES,
    data: {
      __typename: 'Home',
      id: HOME,
      invitesConnection: {
        totalCount: invites.length,
        edges: nodes(invites, 'HomeInvite'),
      },
    },
  });
}

function seedLocations(
  cache: ApolloCache,
  homeId: string,
  ids: readonly string[],
): void {
  seedQuery(cache, {
    query: GetStorageLocationsDocument,
    variables: { homeId },
    data: {
      storageLocations: {
        totalCount: ids.length,
        edges: nodes(ids, 'StorageLocation'),
      },
    },
  });
}

function seedPantryLocations(cache: ApolloCache, ids: readonly string[]) {
  seedFragment(cache, {
    id: `Pantry:${PANTRY}`,
    fragment: PANTRY_LOCATIONS,
    data: {
      __typename: 'Pantry',
      id: PANTRY,
      homeId: HOME,
      storageLocationsConnection: { edges: nodes(ids, 'StorageLocation') },
    },
  });
}

const idsIn = (connection: { edges: { node: { id: string } }[] } | undefined) =>
  connection?.edges.map(edge => edge.node.id);

const membersOf = (cache: ApolloCache) =>
  cache.readFragment<{
    membersConnection: {
      totalCount: number;
      edges: { node: { id: string } }[];
    };
  }>({ id: `Home:${HOME}`, fragment: MEMBERS })?.membersConnection;

const invitesOf = (cache: ApolloCache) =>
  idsIn(
    cache.readFragment<{
      invitesConnection: { edges: { node: { id: string } }[] };
    }>({ id: `Home:${HOME}`, fragment: INVITES })?.invitesConnection,
  );

const locationsOf = (cache: ApolloCache, homeId = HOME) =>
  cache.readQuery({ query: GetStorageLocationsDocument, variables: { homeId } })
    ?.storageLocations;

const pantryLocationsOf = (cache: ApolloCache) =>
  idsIn(
    cache.readFragment<{
      storageLocationsConnection: { edges: { node: { id: string } }[] };
    }>({ id: `Pantry:${PANTRY}`, fragment: PANTRY_LOCATIONS })
      ?.storageLocationsConnection,
  );

const placed = (cache: ApolloCache, write: (cache: ApolloCache) => void) =>
  cache.batch({ optimistic: false, update: write });

describe('the rows a home lists', () => {
  it('names its members, invites and locations, and no other home’s', () => {
    const cache = makeCache();
    seedHome(cache, { members: ['member-1'], invites: ['invite-1'] });
    seedLocations(cache, HOME, ['loc-1']);
    seedLocations(cache, OTHER_HOME, ['loc-9']);

    expect(homeRowsHeld(cache, HOME)).toEqual({
      members: ['member-1'],
      invites: ['invite-1'],
      locations: ['loc-1'],
    });
  });
});

describe('a member another device added', () => {
  it('drops a list in another order, read again when next asked', () => {
    const cache = makeCache();
    seedHome(cache, { members: ['member-1'] });
    seedFragment(cache, {
      id: `Home:${HOME}`,
      fragment: OLDEST_MEMBERS,
      data: {
        __typename: 'Home',
        id: HOME,
        membersConnection: { edges: nodes(['member-1'], 'Membership') },
      },
    });

    placed(cache, c => dropOrderedMembers(c, HOME));

    expect(
      cache.readFragment({ id: `Home:${HOME}`, fragment: OLDEST_MEMBERS }),
    ).toBeNull();
    expect(idsIn(membersOf(cache))).toEqual(['member-1']);
  });

  it('leaves the list and the cache when it left', () => {
    const cache = makeCache();
    seedHome(cache, { members: ['member-1', 'member-2'] });

    placed(cache, c => dropMember(c, HOME, 'member-2'));

    expect(idsIn(membersOf(cache))).toEqual(['member-1']);
    expect(membersOf(cache)?.totalCount).toBe(1);
    expect(cache.extract()).not.toHaveProperty('Membership:member-2');
  });
});

describe('an invite another device made', () => {
  it('leaves the invites and the cache once it stops pending', () => {
    const cache = makeCache();
    seedHome(cache, { invites: ['invite-1'] });

    placed(cache, c => dropInvite(c, HOME, 'invite-1'));

    expect(invitesOf(cache)).toEqual([]);
    expect(cache.extract()).not.toHaveProperty('HomeInvite:invite-1');
  });
});

describe('a location another device made', () => {
  // The summary read has listed it for the home, complete.
  it('joins each held pantry of its home, once', () => {
    const cache = makeCache();
    seedLocations(cache, HOME, ['loc-1', 'loc-2']);
    seedPantryLocations(cache, ['loc-1']);

    placed(cache, c => listInHeldPantries(c, HOME, ['loc-2', 'loc-2']));

    expect(pantryLocationsOf(cache)).toEqual(['loc-1', 'loc-2']);
    expect(idsIn(locationsOf(cache))).toEqual(['loc-1', 'loc-2']);
  });

  it('joins no pantry of another home', () => {
    const cache = makeCache();
    seedLocations(cache, OTHER_HOME, ['loc-9']);
    seedPantryLocations(cache, ['loc-1']);

    placed(cache, c => listInHeldPantries(c, OTHER_HOME, ['loc-9']));

    expect(pantryLocationsOf(cache)).toEqual(['loc-1']);
  });

  it('leaves every list and the cache when it was deleted', () => {
    const cache = makeCache();
    seedLocations(cache, HOME, ['loc-1', 'loc-2']);
    seedPantryLocations(cache, ['loc-1', 'loc-2']);

    placed(cache, c => dropLocation(c, HOME, 'loc-2'));

    expect(idsIn(locationsOf(cache))).toEqual(['loc-1']);
    expect(locationsOf(cache)?.totalCount).toBe(1);
    expect(pantryLocationsOf(cache)).toEqual(['loc-1']);
    expect(cache.extract()).not.toHaveProperty('StorageLocation:loc-2');
  });
});

describe('a home read in full', () => {
  it('keeps only the rows the read holds', () => {
    const cache = makeCache();
    seedHome(cache, {
      members: ['member-1', 'member-2'],
      invites: ['invite-1'],
    });
    seedLocations(cache, HOME, ['loc-1', 'loc-2']);

    const before = homeRowsHeld(cache, HOME);

    placed(cache, c =>
      keepHomeRows(c, HOME, new Set(['member-1', 'loc-2']), before),
    );

    expect(idsIn(membersOf(cache))).toEqual(['member-1']);
    expect(invitesOf(cache)).toEqual([]);
    expect(idsIn(locationsOf(cache))).toEqual(['loc-2']);
  });
});

describe('a home the person has lost', () => {
  it('takes its members, invites and locations off the device', () => {
    const cache = makeCache();
    seedHome(cache, { members: ['member-1'], invites: ['invite-1'] });
    seedLocations(cache, HOME, ['loc-1']);
    seedLocations(cache, OTHER_HOME, ['loc-9']);

    placed(cache, c => evictHomeRows(c, HOME));

    const stored = cache.extract();
    expect(stored).not.toHaveProperty('Membership:member-1');
    expect(stored).not.toHaveProperty('HomeInvite:invite-1');
    expect(stored).not.toHaveProperty('StorageLocation:loc-1');
    expect(locationsOf(cache)).toBeUndefined();
    expect(idsIn(locationsOf(cache, OTHER_HOME))).toEqual(['loc-9']);
  });
});
