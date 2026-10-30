'use no memo';

import { captureOnData } from '#/test-utils/subscriptionCapture';
import { act, waitFor } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { useApolloClient, useQuery } from '@apollo/client/react';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import type { SubscriptionConfig } from '#/services/subscriptions/types';
import { HomeSubtype } from '#/graphql/generated/schemaTypes';
import { GetHomesDocument } from '#operations/home/home.generated';
import { GetHomeDocument } from '#features/home/screens/useHomeDetailManagement.generated';
import { GetMyPendingInvitesDocument } from '#features/onboarding/screens/useOnboardingInvites.generated';
import { HomeDetailScreen_HomeFragmentDoc } from '#features/home/screens/HomeDetailScreen.generated';
import { HomeInvitesForEventDocument } from '../useHomeSubscriptions.generated';
import { useStore } from '#store/index';
import { useHomeSubscriptions } from '../useHomeSubscriptions';

const mockRegister = jest.fn().mockReturnValue({});
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    register: (config: SubscriptionConfig) => mockRegister(config),
  },
}));

// The viewer's row in `home-1`, as the home list caches it.
const cacheWithViewerMembership = (membershipId: string) => {
  const cache = makeCache();
  seedFragment(cache, {
    id: cache.identify({ __typename: 'Home', id: 'home-1' }),
    fragment: gql`
      fragment TestViewerMembership on Home {
        id
        myMembership {
          id
        }
      }
    `,
    data: {
      __typename: 'Home',
      id: 'home-1',
      myMembership: { __typename: 'Membership', id: membershipId },
    },
  });
  return cache;
};

function deliverMembershipEvent(
  subtype: HomeSubtype,
  membershipId: string,
  cache: ReturnType<typeof makeCache>,
) {
  const getOnData = captureOnData(mockRegister);
  renderHookWithApollo(() => useHomeSubscriptions('member-1'));

  const refetchQueries = jest.fn(() => Promise.resolve([]));
  const client = { refetchQueries, cache };
  getOnData()(
    {
      __typename: 'HomeEvent',
      subtype,
      homeId: 'home-1',
      actorUserId: 'owner-1',
      node: { __typename: 'Membership', id: membershipId },
    },
    client,
  );
  return refetchQueries;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRegister.mockReturnValue({});
  useStore.setState({ selectedHomeId: 'home-1' });
});

describe('useHomeSubscriptions', () => {
  // The pantry's delete, waste-batch and discard actions read `myMembership`
  // off `GetHomes`, which is mounted all session; `GetHome` is only while a
  // home screen is open. Refetching `GetHome` alone left an owner's grant or
  // revoke invisible to the member until the next launch.
  it.each([HomeSubtype.MembershipUpdated, HomeSubtype.MembershipRoleChanged])(
    'refetches the home list on %s of the viewer, so permissions land live',
    subtype => {
      const refetchQueries = deliverMembershipEvent(
        subtype,
        'membership-1',
        cacheWithViewerMembership('membership-1'),
      );

      expect(refetchQueries).toHaveBeenCalledWith({
        include: ['GetHome', GetHomesDocument],
      });
    },
  );

  // Every member's device receives every member's event; refetching the whole
  // home list for each one multiplies a single join by the member count.
  it.each([
    HomeSubtype.MembershipJoined,
    HomeSubtype.MembershipLeft,
    HomeSubtype.MembershipUpdated,
    HomeSubtype.MembershipRoleChanged,
  ])('leaves the home list alone on %s of another member', subtype => {
    const refetchQueries = deliverMembershipEvent(
      subtype,
      'membership-2',
      cacheWithViewerMembership('membership-1'),
    );

    expect(refetchQueries).toHaveBeenCalledWith({
      include: ['GetHome'],
    });
  });

  it('refetches the home list when the viewer’s row is not cached', () => {
    const refetchQueries = deliverMembershipEvent(
      HomeSubtype.MembershipUpdated,
      'membership-2',
      makeCache(),
    );

    expect(refetchQueries).toHaveBeenCalledWith({
      include: ['GetHome', GetHomesDocument],
    });
  });
});

describe('useHomeSubscriptions: an invite a co-admin sent', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // MockLink answers on a timer; the read-back then resolves a microtask later.
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        jest.advanceTimersByTime(50);
      });
    }
  };

  it("appears in the home's invite list without a refresh", async () => {
    const home = recordMock(GetHomeDocument, {
      data: {
        home: {
          __typename: 'Home',
          id: 'home-1',
          invitesConnection: {
            __typename: 'HomeInviteConnection',
            edges: [],
            totalCount: 0,
          },
        },
      },
    });
    const readBack = recordMock(HomeInvitesForEventDocument, {
      data: {
        home: {
          __typename: 'Home',
          id: 'home-1',
          invitesConnection: {
            __typename: 'HomeInviteConnection',
            edges: [
              {
                __typename: 'HomeInviteEdge',
                node: {
                  __typename: 'HomeInvite',
                  id: 'invite-1',
                  email: 'guest@example.com',
                },
              },
            ],
            totalCount: 1,
          },
        },
      },
    });
    const pending = recordMock(GetMyPendingInvitesDocument, {});
    const getOnData = captureOnData(mockRegister);
    const { result } = renderHookWithApollo(
      () => {
        useHomeSubscriptions('admin-2');
        const { data } = useQuery(GetHomeDocument, {
          variables: { homeId: 'home-1' },
        });
        return { client: useApolloClient(), data };
      },
      { operationMocks: [home.mock, readBack.mock, pending.mock] },
    );
    await settle();
    await waitFor(() => expect(result.current.data?.home?.id).toBe('home-1'));

    await act(async () => {
      getOnData()(
        {
          __typename: 'HomeEvent',
          subtype: HomeSubtype.InviteCreated,
          homeId: 'home-1',
          actorUserId: 'admin-1',
          node: { __typename: 'HomeInvite', id: 'invite-1' },
        },
        result.current.client,
      );
    });
    await settle();

    expect(readBack.fired).toEqual([{ id: 'home-1' }]);
    const detail = result.current.client.cache.readFragment({
      fragment: HomeDetailScreen_HomeFragmentDoc,
      fragmentName: 'HomeDetailScreen_home',
      from: { __typename: 'Home', id: 'home-1' },
    });
    expect(detail?.invitesConnection.edges.map(edge => edge.node.id)).toEqual([
      'invite-1',
    ]);
    // The screen's own query stays complete: it is not refetched whole.
    expect(home.fired).toHaveLength(1);
    expect(result.current.data?.home?.id).toBe('home-1');
  });
});
