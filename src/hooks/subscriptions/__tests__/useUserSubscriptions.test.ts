'use no memo';

import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import type { SubscriptionConfig } from '#/services/subscriptions/types';
import { UserSubtype } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store/index';
import { useUserSubscriptions } from '../useUserSubscriptions';

type CapturedOnData = (data: unknown) => void;

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockRegister = jest.fn().mockReturnValue({});
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    register: (config: SubscriptionConfig) => mockRegister(config),
  },
}));

jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn() },
}));

/** Captures the hook's customOnData so tests can drive it with a payload. */
function captureCustomOnData() {
  let customOnData: CapturedOnData | undefined;
  mockRegister.mockImplementation((config: SubscriptionConfig) => {
    customOnData = config.customOnData as CapturedOnData | undefined;
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
  useStore.setState({
    selectedHomeId: 'home-1',
    selectedPantryId: 'pantry-1',
    selectedShoppingListId: 'list-1',
    selectedMealPlanId: 'plan-1',
  });
});

describe('useUserSubscriptions', () => {
  it('clears every entity selection when removed from the selected home', () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useUserSubscriptions('user-1'));

    getOnData()({
      __typename: 'UserEvent',
      subtype: UserSubtype.RemovedFromHome,
      parents: { homeId: 'home-1' },
    });

    const state = useStore.getState();
    // Each of these is persisted, so a leftover id keeps naming a resource in
    // the home the user just lost — and every read for it comes back FORBIDDEN.
    expect(state.selectedHomeId).toBeNull();
    expect(state.selectedPantryId).toBeNull();
    expect(state.selectedShoppingListId).toBeNull();
    expect(state.selectedMealPlanId).toBeNull();
  });

  it('leaves selections alone when removed from a home that is not selected', () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useUserSubscriptions('user-1'));

    getOnData()({
      __typename: 'UserEvent',
      subtype: UserSubtype.RemovedFromHome,
      parents: { homeId: 'home-other' },
    });

    const state = useStore.getState();
    expect(state.selectedHomeId).toBe('home-1');
    expect(state.selectedMealPlanId).toBe('plan-1');
  });
});
