import { gql, type ApolloClient } from '@apollo/client';
import { FeedEngine } from '#/apollo/feed/feedEngine';
import {
  clearPositions,
  holdPosition,
  positionOf,
} from '#/apollo/feed/feedPositions';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { SyncPageStatus, SyncScopeKind } from '#/graphql/generated/schemaTypes';
import { seedFragment, seedQuery } from '#/test-utils/apolloMockProvider';
import {
  clientOver,
  fault,
  homePulls,
  homeSummaries,
  page,
  pulled,
  snapshots,
  wholeList,
  type Server,
} from '#/test-utils/feedServer';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import {
  CreateStorageLocationDocument,
  GetStorageLocationsDocument,
} from '#features/catalog/graphql/storageLocation.generated';
import { GetHomesDocument } from '#operations/home/home.generated';
import { useStore } from '#store';

jest.mock('#/services/auth/deviceId');

let mockClient: ApolloClient | null = null;
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  requireApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

const HOME = 'home-1';
const OTHER_HOME = 'home-2';
const PANTRY = 'pantry-1';

const MEMBERS = gql`
  fragment TestFeedHomeMembers on Home {
    id
    membersConnection(first: 20) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

const MY_MEMBERSHIP = gql`
  fragment TestFeedMyMembership on Home {
    id
    myMembership {
      id
      role
    }
  }
`;

const MY_PANTRY_ACCESS = gql`
  fragment TestFeedMyPantryAccess on Home {
    id
    myMembership {
      id
      canViewPantry
    }
  }
`;

const INVITES = gql`
  fragment TestFeedHomeInvites on Home {
    id
    invitesConnection(first: 20) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

const PANTRY_LOCATIONS = gql`
  fragment TestFeedPantryLocations on Pantry {
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

const JOIN_LINK = gql`
  fragment TestFeedJoinLink on Home {
    id
    joinCode
    allowJoinCode
    joinLink {
      universal
    }
  }
`;

// What an invite card caches of the home it names.
const INVITED_HOME = gql`
  fragment TestFeedInvitedHome on Home {
    id
    version
    name
  }
`;

const HOMES = gql`
  query TestFeedHomes {
    homes(first: 20) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

const home = (overrides: Record<string, unknown> = {}) => ({
  __typename: 'Home',
  id: HOME,
  version: 1,
  name: 'Test Home',
  ...overrides,
});
const member = (id: string, overrides: Record<string, unknown> = {}) => ({
  __typename: 'Membership',
  id,
  version: 1,
  userId: `user-${id}`,
  role: 'MEMBER',
  ...overrides,
});
const location = (id: string, parentId: string | null = null) => ({
  __typename: 'StorageLocation',
  id,
  version: 1,
  name: `Shelf ${id}`,
  parentLocation: parentId
    ? { __typename: 'StorageLocation', id: parentId, version: 1 }
    : null,
});
const invite = (id: string) => ({
  __typename: 'HomeInvite',
  id,
  version: 1,
  email: `${id}@example.com`,
});
const edgesOf = (rows: readonly Record<string, unknown>[]) => ({
  edges: rows.map(node => ({ node })),
});

/** The server's summary of the home: its members, locations and the person's own. */
const summary = ({
  members = [],
  locations = [],
  mine,
  homeFields = {},
}: {
  members?: Record<string, unknown>[];
  locations?: Record<string, unknown>[];
  mine?: Record<string, unknown>;
  homeFields?: Record<string, unknown>;
}) => ({
  data: {
    home: {
      ...home(homeFields),
      membersConnection: edgesOf(members),
      invitesConnection: edgesOf([]),
      ...(mine && { myMembership: mine }),
    },
    storageLocations: edgesOf(locations),
  },
});

const joinLinkOf = (code: string) => ({
  __typename: 'ShareLink',
  universal: `https://example.com/join/${code}`,
});

/** The join code, switch and link a held home was last read with. */
function holdJoin(client: ApolloClient, code: string): void {
  seedFragment(client.cache, {
    id: `Home:${HOME}`,
    fragment: JOIN_LINK,
    data: {
      __typename: 'Home',
      id: HOME,
      joinCode: code,
      allowJoinCode: true,
      joinLink: joinLinkOf(code),
    },
  });
}

const joinLinkHeld = (client: ApolloClient) =>
  client.cache.readFragment<{ joinLink: { universal: string } | null }>({
    id: `Home:${HOME}`,
    fragment: JOIN_LINK,
  })?.joinLink?.universal;

const listedHome = (cursor: string, ids: readonly string[] = [HOME]) => ({
  data: {
    syncScopes: {
      edges: ids.map(id => ({
        node: { kind: SyncScopeKind.Home, id, cursor },
      })),
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  },
});

let engine: FeedEngine;

/** A home the device holds at `kept`, listing these members, before the engine starts. */
function holdHome(
  client: ApolloClient,
  members: readonly string[],
  mine?: string,
): void {
  seedFragment(client.cache, {
    id: `Home:${HOME}`,
    fragment: MEMBERS,
    data: {
      __typename: 'Home',
      id: HOME,
      membersConnection: edgesOf(members.map(id => member(id))),
    },
  });
  if (mine) {
    seedFragment(client.cache, {
      id: `Home:${HOME}`,
      fragment: MY_MEMBERSHIP,
      data: {
        __typename: 'Home',
        id: HOME,
        myMembership: member(mine),
      },
    });
  }
  holdPosition(HOME, {
    kind: SyncScopeKind.Home,
    cursor: 'kept',
    snapshotAt: Date.now(),
  });
}

/** One pull from `kept` of a held home, with the server answering `rest`. */
async function pullOnce(
  changes: Record<string, unknown>,
  rest: Partial<Server> = {},
  seed: (client: ApolloClient) => void = () => {},
): Promise<ApolloClient> {
  const client = clientOver({
    scopes: () => listedHome('latest'),
    homePull: () => pulled([page(HOME, { cursor: 'latest', ...changes })]),
    ...rest,
  });
  mockClient = client;
  seed(client);
  engine.start([SyncScopeKind.Home]);
  await engine.whenSettled();
  return client;
}

const membersOf = (client: ApolloClient) =>
  client.cache
    .readFragment<{
      membersConnection: { edges: { node: { id: string } }[] };
    }>({ id: `Home:${HOME}`, fragment: MEMBERS })
    ?.membersConnection.edges.map(edge => edge.node.id);

const myMembershipOf = (client: ApolloClient) =>
  client.cache.readFragment<{ myMembership: { id: string; role: string } }>({
    id: `Home:${HOME}`,
    fragment: MY_MEMBERSHIP,
  })?.myMembership;

beforeEach(() => {
  homePulls.length = 0;
  homeSummaries.length = 0;
  snapshots.length = 0;
  clearPositions();
  useStore.setState({ isOnline: true, apiReachable: true });
  engine = new FeedEngine();
});

afterEach(() => {
  engine.stop();
  jest.restoreAllMocks();
});

describe('a page on a held home', () => {
  it('lists a member another device added, through the summary', async () => {
    const client = await pullOnce(
      { changed: [member('member-2')] },
      {
        homeSummary: () =>
          summary({ members: [member('member-1'), member('member-2')] }),
      },
      seeded => holdHome(seeded, ['member-1']),
    );

    expect(homeSummaries).toEqual([HOME]);
    expect(membersOf(client)).toEqual(['member-1', 'member-2']);
    expect(positionOf(HOME)?.cursor).toBe('latest');
  });

  it('reads no summary for a rename', async () => {
    const client = await pullOnce(
      {
        changed: [
          home({ name: 'Our Place', joinCode: 'ABC123', allowJoinCode: true }),
        ],
      },
      {},
      seeded => {
        holdHome(seeded, ['member-1']);
        holdJoin(seeded, 'ABC123');
      },
    );

    expect(homeSummaries).toEqual([]);
    expect(membersOf(client)).toEqual(['member-1']);
  });

  it('reads the join link again when another device changes the code', async () => {
    const client = await pullOnce(
      {
        changed: [home({ joinCode: 'XYZ789', allowJoinCode: true })],
      },
      {
        homeSummary: () =>
          summary({
            members: [member('member-1')],
            homeFields: {
              joinCode: 'XYZ789',
              allowJoinCode: true,
              joinLink: joinLinkOf('XYZ789'),
            },
          }),
      },
      seeded => {
        holdHome(seeded, ['member-1']);
        holdJoin(seeded, 'ABC123');
      },
    );

    expect(homeSummaries).toEqual([HOME]);
    expect(joinLinkHeld(client)).toBe('https://example.com/join/XYZ789');
  });

  it('reads the join link again when another device turns joining off', async () => {
    const client = await pullOnce(
      {
        changed: [home({ joinCode: 'ABC123', allowJoinCode: false })],
      },
      {
        homeSummary: () =>
          summary({
            members: [member('member-1')],
            homeFields: {
              joinCode: 'ABC123',
              allowJoinCode: false,
              joinLink: null,
            },
          }),
      },
      seeded => {
        holdHome(seeded, ['member-1']);
        holdJoin(seeded, 'ABC123');
      },
    );

    expect(homeSummaries).toEqual([HOME]);
    expect(joinLinkHeld(client)).toBeUndefined();
  });

  it('ignores a row of another kind', async () => {
    await pullOnce({ changed: [{ __typename: 'ShoppingList' }] }, {}, seeded =>
      holdHome(seeded, ['member-1']),
    );

    expect(homeSummaries).toEqual([]);
    expect(positionOf(HOME)?.cursor).toBe('latest');
  });

  it('takes a member who left out of the list and the cache', async () => {
    const client = await pullOnce(
      { removed: [{ entityType: 'Membership', id: 'member-2' }] },
      { homeSummary: () => summary({ members: [member('member-1')] }) },
      seeded => holdHome(seeded, ['member-1', 'member-2']),
    );

    expect(membersOf(client)).toEqual(['member-1']);
    expect(client.cache.extract()).not.toHaveProperty('Membership:member-2');
  });

  it('lists a new location in each held pantry of the home', async () => {
    const client = await pullOnce(
      { changed: [location('loc-2')] },
      {
        homeSummary: () =>
          summary({ locations: [location('loc-1'), location('loc-2')] }),
      },
      seeded => {
        holdHome(seeded, []);
        seedFragment(seeded.cache, {
          id: `Pantry:${PANTRY}`,
          fragment: PANTRY_LOCATIONS,
          data: {
            __typename: 'Pantry',
            id: PANTRY,
            homeId: HOME,
            storageLocationsConnection: edgesOf([location('loc-1')]),
          },
        });
      },
    );

    expect(
      client.cache
        .readFragment<{
          storageLocationsConnection: { edges: { node: { id: string } }[] };
        }>({ id: `Pantry:${PANTRY}`, fragment: PANTRY_LOCATIONS })
        ?.storageLocationsConnection.edges.map(edge => edge.node.id),
    ).toEqual(['loc-1', 'loc-2']);
    expect(
      client.cache
        .readQuery({
          query: GetStorageLocationsDocument,
          variables: { homeId: HOME },
        })
        ?.storageLocations.edges.map(edge => edge.node.id),
    ).toEqual(['loc-1', 'loc-2']);
  });

  it('leaves a new member unlisted and reads the home in full next, when the summary fails', async () => {
    let summaryFails = true;
    const client = await pullOnce(
      { changed: [member('member-2')] },
      {
        homeSnapshot: () =>
          wholeList([home(), member('member-1'), member('member-2')]),
        homeSummary: () =>
          summaryFails
            ? fault()
            : summary({ members: [member('member-1'), member('member-2')] }),
      },
      seeded => holdHome(seeded, ['member-1']),
    );

    expect(membersOf(client)).toEqual(['member-1']);
    expect(positionOf(HOME)?.cursor).toBe('latest');
    expect(snapshots).toEqual([]);

    summaryFails = false;
    engine.catchUp();
    await engine.whenSettled();

    expect(snapshots).toEqual([expect.objectContaining({ id: HOME })]);
    expect(membersOf(client)).toEqual(['member-1', 'member-2']);
  });

  // Even with no summary, the row the home names as the person's moves.
  it('shows the person’s new role from the pull', async () => {
    const client = await pullOnce(
      { changed: [member('member-1', { role: 'OWNER' })] },
      { homeSummary: () => fault() },
      seeded => holdHome(seeded, ['member-1'], 'member-1'),
    );

    expect(myMembershipOf(client)).toMatchObject({
      id: 'member-1',
      role: 'OWNER',
    });
  });

  it('shows the person’s pantry access turned off, from the pull', async () => {
    const client = await pullOnce(
      { changed: [member('member-1', { canViewPantry: false })] },
      { homeSummary: () => fault() },
      seeded => {
        holdHome(seeded, ['member-1']);
        seedFragment(seeded.cache, {
          id: `Home:${HOME}`,
          fragment: MY_PANTRY_ACCESS,
          data: {
            __typename: 'Home',
            id: HOME,
            myMembership: {
              __typename: 'Membership',
              id: 'member-1',
              canViewPantry: true,
            },
          },
        });
      },
    );

    expect(
      client.cache.readFragment<{
        myMembership: { id: string; canViewPantry: boolean };
      }>({ id: `Home:${HOME}`, fragment: MY_PANTRY_ACCESS })?.myMembership,
    ).toEqual({
      __typename: 'Membership',
      id: 'member-1',
      canViewPantry: false,
    });
  });

  // The tree is drawn from each location's parent, so the row alone moves it.
  it('moves a location under the parent another device gave it', async () => {
    const client = await pullOnce(
      { changed: [location('loc-2', 'loc-1')] },
      { homeSummary: () => fault() },
      seeded => {
        holdHome(seeded, []);
        seedQuery(seeded.cache, {
          query: GetStorageLocationsDocument,
          variables: { homeId: HOME },
          data: {
            storageLocations: edgesOf([location('loc-1'), location('loc-2')]),
          },
        });
      },
    );

    expect(
      client.cache
        .readQuery({
          query: GetStorageLocationsDocument,
          variables: { homeId: HOME },
        })
        ?.storageLocations.edges.map(({ node }) => [
          node.id,
          node.parentLocation?.id ?? null,
        ]),
    ).toEqual([
      ['loc-1', null],
      ['loc-2', 'loc-1'],
    ]);
  });

  it('takes an accepted invite out and lists the member it made', async () => {
    const client = await pullOnce(
      {
        changed: [member('member-2')],
        removed: [{ entityType: 'HomeInvite', id: 'invite-1' }],
      },
      {
        homeSummary: () =>
          summary({ members: [member('member-1'), member('member-2')] }),
      },
      seeded => {
        holdHome(seeded, ['member-1']);
        seedFragment(seeded.cache, {
          id: `Home:${HOME}`,
          fragment: INVITES,
          data: {
            __typename: 'Home',
            id: HOME,
            invitesConnection: edgesOf([invite('invite-1')]),
          },
        });
      },
    );

    expect(
      client.cache
        .readFragment<{
          invitesConnection: { edges: { node: { id: string } }[] };
        }>({ id: `Home:${HOME}`, fragment: INVITES })
        ?.invitesConnection.edges.map(edge => edge.node.id),
    ).toEqual([]);
    expect(client.cache.extract()).not.toHaveProperty('HomeInvite:invite-1');
    expect(membersOf(client)).toEqual(['member-1', 'member-2']);
  });

  it('is not pulled while a create in it waits for the server', async () => {
    jest
      .spyOn(queueStore, 'holdsCreateFor')
      .mockImplementation(id => id === HOME);

    await pullOnce({ changed: [member('member-2')] }, {}, seeded =>
      holdHome(seeded, ['member-1']),
    );

    expect(homePulls).toEqual([]);
  });
});

describe('a home with a location made offline', () => {
  afterEach(() => queueStore.removeMutation('queued-location'));

  it('is not pulled until the server takes the location', async () => {
    queueStore.setCurrentUserId('user-1');
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'queued-location',
        ...queuedMutationFor(CreateStorageLocationDocument),
        variables: {
          input: {
            id: 'loc-new',
            homeId: HOME,
            name: 'Garage',
            type: 'GARAGE',
          },
        },
      }),
    );

    await pullOnce({ changed: [location('loc-2')] }, {}, seeded =>
      holdHome(seeded, ['member-1']),
    );

    expect(homePulls).toEqual([]);
  });
});

describe('a full read of a home', () => {
  const fullRead = (
    rest: Partial<Server>,
    seed: (client: ApolloClient) => void = () => {},
  ) =>
    pullOnce(
      {},
      {
        homePull: ({ scopes }) => {
          const [{ cursor } = { cursor: null }] = scopes;
          return cursor === null
            ? pulled([
                page(HOME, {
                  status: SyncPageStatus.ResyncRequired,
                  cursor: null,
                }),
              ])
            : pulled([page(HOME, { cursor: 'latest' })]);
        },
        ...rest,
      },
      seed,
    );

  it('names the person’s membership of a home first known through the feed', async () => {
    const client = await fullRead({
      homeSnapshot: () => wholeList([home(), member('member-1')]),
      homeSummary: () =>
        summary({
          members: [member('member-1')],
          mine: { __typename: 'Membership', id: 'member-1', role: 'OWNER' },
        }),
    });

    expect(homeSummaries).toEqual([HOME]);
    expect(myMembershipOf(client)).toMatchObject({ id: 'member-1' });
    expect(positionOf(HOME)).toBeDefined();
  });

  it('adds a gained home to the homes list', async () => {
    const client = await fullRead(
      {
        homeSnapshot: () => wholeList([home()]),
        homeSummary: () => summary({}),
      },
      seeded =>
        seedQuery(seeded.cache, {
          query: HOMES,
          data: {
            homes: edgesOf([{ __typename: 'Home', id: OTHER_HOME }]),
          },
        }),
    );

    expect(
      client.cache
        .readQuery<{ homes: { edges: { node: { id: string } }[] } }>({
          query: HOMES,
        })
        ?.homes.edges.map(edge => edge.node.id),
    ).toEqual([OTHER_HOME, HOME]);
  });

  it('lists a home whose invite the person accepted elsewhere, complete', async () => {
    const client = await fullRead(
      {
        homeSnapshot: () => wholeList([home(), member('member-1')]),
        homeSummary: () => summary({ members: [member('member-1')] }),
      },
      seeded => {
        seedFragment(seeded.cache, {
          id: `Home:${HOME}`,
          fragment: INVITED_HOME,
          data: { __typename: 'Home', id: HOME, version: 1, name: 'Theirs' },
        });
        seedQuery(seeded.cache, {
          query: GetHomesDocument,
          variables: { first: 20 },
          data: {
            homes: edgesOf([{ __typename: 'Home', id: OTHER_HOME }]),
          },
        });
      },
    );

    expect(
      client.cache
        .readQuery({ query: GetHomesDocument, variables: { first: 20 } })
        ?.homes.edges.map(edge => edge.node.id),
    ).toEqual([OTHER_HOME, HOME]);
  });

  it('keeps a member who joined between the read and its summary', async () => {
    const client = await fullRead(
      {
        homeSnapshot: () => wholeList([home(), member('member-1')]),
        homeSummary: () =>
          summary({ members: [member('member-1'), member('member-2')] }),
      },
      seeded =>
        seedFragment(seeded.cache, {
          id: `Home:${HOME}`,
          fragment: MEMBERS,
          data: {
            __typename: 'Home',
            id: HOME,
            membersConnection: edgesOf([member('member-1')]),
          },
        }),
    );

    expect(membersOf(client)).toEqual(['member-1', 'member-2']);
    expect(client.cache.extract()).toHaveProperty('Membership:member-2');
  });

  it('evicts a location the read does not hold', async () => {
    const client = await fullRead(
      {
        homeSnapshot: () => wholeList([home(), location('loc-1')]),
        homeSummary: () => summary({ locations: [location('loc-1')] }),
      },
      seeded =>
        seedQuery(seeded.cache, {
          query: GetStorageLocationsDocument,
          variables: { homeId: HOME },
          data: {
            storageLocations: edgesOf([location('loc-1'), location('loc-9')]),
          },
        }),
    );

    expect(client.cache.extract()).not.toHaveProperty('StorageLocation:loc-9');
  });

  it('holds no position when its summary fails', async () => {
    await fullRead({
      homeSnapshot: () => wholeList([home()]),
      homeSummary: () => fault(),
    });

    expect(positionOf(HOME)).toBeUndefined();
  });
});

describe('a home the person has lost', () => {
  it('leaves the device, and another home is selected', async () => {
    const client = clientOver({ scopes: () => listedHome('latest', []) });
    mockClient = client;
    holdHome(client, ['member-1']);
    seedQuery(client.cache, {
      query: GetHomesDocument,
      variables: { first: 20 },
      data: {
        homes: edgesOf([
          { __typename: 'Home', id: HOME },
          { __typename: 'Home', id: OTHER_HOME },
        ]),
      },
    });
    useStore.setState({ selectedHomeId: HOME });

    engine.start([SyncScopeKind.Home]);
    await engine.whenSettled();

    expect(client.cache.extract()).not.toHaveProperty(`Home:${HOME}`);
    expect(client.cache.extract()).not.toHaveProperty('Membership:member-1');
    expect(useStore.getState().selectedHomeId).toBe(OTHER_HOME);
    expect(positionOf(HOME)).toBeUndefined();
  });
});
