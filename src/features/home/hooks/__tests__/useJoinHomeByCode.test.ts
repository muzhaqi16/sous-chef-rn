import { act, waitFor } from '@testing-library/react-native';
import { useApolloClient, useQuery } from '@apollo/client/react';
import type { MockDataFor, MockFor } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  GetHomesDocument,
  JoinHomeByCodeDocument,
} from '#operations/home/home.generated';
import { useJoinHomeByCode } from '../useJoinHomeByCode';

type HomesData = MockDataFor<typeof GetHomesDocument>;
type HomeEdgeData = NonNullable<
  NonNullable<NonNullable<HomesData['homes']>['edges']>[number]
>;

const homeEdge = (id: string): HomeEdgeData => ({
  __typename: 'HomeEdge',
  cursor: id,
  node: { __typename: 'Home', id, name: `Home ${id}` },
});

const homesMock = (ids: string[]): MockFor<typeof GetHomesDocument> => ({
  request: { query: GetHomesDocument, variables: () => true },
  result: {
    data: {
      homes: { __typename: 'HomeConnection', edges: ids.map(homeEdge) },
    },
  },
});

/** The rest of the node is completed from the SDL. */
type JoinedHome = { __typename: 'Home'; id: string; name: string } | null;

const joinMock = (home: JoinedHome = null) =>
  recordMock(JoinHomeByCodeDocument, {
    data: {
      joinHomeByCode: {
        __typename: 'JoinHomeByCodePayload',
        membership: {
          __typename: 'Membership',
          id: 'member-2',
          homeId: 'home-2',
        },
        home,
      },
    },
  });

const failingHomesMock = (): MockFor<typeof GetHomesDocument> => ({
  request: { query: GetHomesDocument, variables: () => true },
  error: new Error('network down'),
});

const cachedHomeIds = (cache: ReturnType<typeof seedCache>) =>
  cache
    .readQuery({ query: GetHomesDocument })
    ?.homes.edges.map(edge => edge.node.id);

describe('useJoinHomeByCode', () => {
  // The join's own answer carries the home, so no second read can fail it.
  it('puts the joined home in the list from its own answer, with the list read failing', async () => {
    const join = joinMock({ __typename: 'Home', id: 'home-2', name: 'Shared' });
    const cache = seedCache([]);
    const { result } = renderHookWithApollo(
      () => ({
        client: useApolloClient(),
        join: useJoinHomeByCode({ code: '', skip: true }),
      }),
      {
        cache,
        operationMocks: [homesMock(['home-1']), join.mock, failingHomesMock()],
      },
    );
    await act(async () => {
      await result.current.client.query({ query: GetHomesDocument });
    });

    let outcome: Awaited<
      ReturnType<typeof result.current.join.joinHome>
    > | null = null;
    await act(async () => {
      outcome = await result.current.join.joinHome('ABCD');
    });

    expect(outcome).toEqual({
      joined: true,
      homeId: 'home-2',
      homeKnown: true,
    });
    expect(cachedHomeIds(cache)).toEqual(['home-1', 'home-2']);
  });

  it('reports the home unknown when the answer has none and the list read fails', async () => {
    const join = joinMock();
    const { result } = renderHookWithApollo(
      () => useJoinHomeByCode({ code: '', skip: true }),
      {
        cache: seedCache([]),
        operationMocks: [join.mock, failingHomesMock()],
      },
    );

    let outcome: Awaited<ReturnType<typeof result.current.joinHome>> | null =
      null;
    await act(async () => {
      outcome = await result.current.joinHome('ABCD');
    });

    expect(outcome).toEqual({
      joined: true,
      homeId: 'home-2',
      homeKnown: false,
    });
  });

  // Without a home in the answer, the list is read before the caller selects.
  it('has the joined home in the homes list when it reports joined', async () => {
    const join = joinMock();
    const cache = seedCache([]);
    const { result } = renderHookWithApollo(
      () => {
        const homes = useQuery(GetHomesDocument);
        return {
          homeIds: homes.data?.homes.edges.map(edge => edge.node.id),
          join: useJoinHomeByCode({ code: '', skip: true }),
        };
      },
      {
        cache,
        operationMocks: [
          homesMock(['home-1']),
          join.mock,
          homesMock(['home-1', 'home-2']),
        ],
      },
    );
    await waitFor(() => expect(result.current.homeIds).toEqual(['home-1']));

    let cachedWhenJoined: string[] | undefined;
    await act(async () => {
      const outcome = await result.current.join.joinHome('ABCD');
      expect(outcome).toEqual({
        joined: true,
        homeId: 'home-2',
        homeKnown: true,
      });
      cachedWhenJoined = cache
        .readQuery({ query: GetHomesDocument })
        ?.homes.edges.map(edge => edge.node.id);
    });

    expect(cachedWhenJoined).toEqual(['home-1', 'home-2']);
  });
  // Nothing watches the homes list while the join screen is on top, and a
  // refetch re-runs only watched queries.
  it('loads the joined home into the cached list when no screen watches it', async () => {
    const join = joinMock();
    const cache = seedCache([]);
    const { result } = renderHookWithApollo(
      () => ({
        client: useApolloClient(),
        join: useJoinHomeByCode({ code: '', skip: true }),
      }),
      {
        cache,
        operationMocks: [
          homesMock(['home-1']),
          join.mock,
          homesMock(['home-1', 'home-2']),
        ],
      },
    );
    // Cached by a one-off read, so no observer is left watching it.
    await act(async () => {
      await result.current.client.query({ query: GetHomesDocument });
    });

    await act(async () => {
      await result.current.join.joinHome('ABCD');
    });

    expect(cachedHomeIds(cache)).toEqual(['home-1', 'home-2']);
  });
});
