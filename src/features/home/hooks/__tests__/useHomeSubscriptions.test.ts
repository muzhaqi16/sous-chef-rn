'use no memo';

import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import type {
  SubscriptionApolloClient,
  SubscriptionConfig,
} from '#/services/subscriptions/types';
import { HomeSubtype } from '#/graphql/generated/schemaTypes';
import {
  GetHomeDocument,
  GetHomesDocument,
} from '#operations/home/home.generated';
import { useStore } from '#store/index';
import { useHomeSubscriptions } from '../useHomeSubscriptions';

type CapturedOnData = (data: unknown, client: SubscriptionApolloClient) => void;

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockRegister = jest.fn().mockReturnValue({});
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    register: (config: SubscriptionConfig) => mockRegister(config),
  },
}));

function captureCustomOnData() {
  let customOnData: CapturedOnData | undefined;
  mockRegister.mockImplementation((config: SubscriptionConfig) => {
    customOnData = config.customOnData;
    return {};
  });
  return (): CapturedOnData => {
    if (!customOnData) throw new Error('customOnData was not captured');
    return customOnData;
  };
}

// The viewer's row in `home-1`, as the home list caches it.
const cacheWithViewerMembership = (membershipId: string) => {
  const cache = makeCache();
  cache.writeFragment({
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
  const getOnData = captureCustomOnData();
  renderHookWithApollo(() => useHomeSubscriptions('member-1'));

  const refetchQueries = jest.fn(() => Promise.resolve([]));
  const client = {
    refetchQueries,
    cache,
  } as unknown as SubscriptionApolloClient;
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
        include: [GetHomeDocument, GetHomesDocument],
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
      include: [GetHomeDocument],
    });
  });

  it('refetches the home list when the viewer’s row is not cached', () => {
    const refetchQueries = deliverMembershipEvent(
      HomeSubtype.MembershipUpdated,
      'membership-2',
      makeCache(),
    );

    expect(refetchQueries).toHaveBeenCalledWith({
      include: [GetHomeDocument, GetHomesDocument],
    });
  });
});
