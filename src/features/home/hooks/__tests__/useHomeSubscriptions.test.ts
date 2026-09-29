'use no memo';

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
    'refetches the home list on %s, so permissions land live',
    subtype => {
      const getOnData = captureCustomOnData();
      renderHookWithApollo(() => useHomeSubscriptions('member-1'));

      const refetchQueries = jest.fn(() => Promise.resolve([]));
      const client = { refetchQueries } as unknown as SubscriptionApolloClient;
      getOnData()(
        {
          __typename: 'HomeEvent',
          subtype,
          actorUserId: 'owner-1',
          node: { __typename: 'Membership', id: 'membership-1' },
        },
        client,
      );

      expect(refetchQueries).toHaveBeenCalledWith({
        include: [GetHomeDocument, GetHomesDocument],
      });
    },
  );
});
