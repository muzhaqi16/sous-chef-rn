'use no memo';

import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import type { SubscriptionConfig } from '#/services/subscriptions/types';
import {
  ModerationReasonCode,
  UserSubtype,
} from '#/graphql/generated/schemaTypes';
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

const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: jest.fn(),
  },
}));

jest.mock('#/services/authService', () => ({
  authService: { logout: jest.fn(() => Promise.resolve()) },
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

  describe('a moderation action', () => {
    const drive = (payload: Record<string, unknown>) => {
      const getOnData = captureCustomOnData();
      renderHookWithApollo(() => useUserSubscriptions('user-1'));
      getOnData()({ __typename: 'UserEvent', ...payload });
    };

    it('says the automatic lockout lifts by itself, with its attempt count', () => {
      drive({
        subtype: UserSubtype.Suspended,
        reasonCode: ModerationReasonCode.FailedLoginAttempts,
        failedLoginCount: 5,
        reason: 'Auto-locked after 5 failed login attempts',
      });

      expect(mockToastError).toHaveBeenCalledWith(
        'Your account is locked after 5 failed sign-in attempts. It unlocks on its own shortly.',
      );
    });

    it('states the lockout without a number when no count arrives', () => {
      drive({
        subtype: UserSubtype.Suspended,
        reasonCode: ModerationReasonCode.FailedLoginAttempts,
        failedLoginCount: null,
      });

      expect(mockToastError).toHaveBeenCalledWith(
        'Your account is locked after too many failed sign-in attempts. It unlocks on its own shortly.',
      );
    });

    it("reads a moderator's decision as one, not as a lockout", () => {
      drive({
        subtype: UserSubtype.Suspended,
        reasonCode: ModerationReasonCode.Moderator,
        reason: 'Spamming the catalog',
      });

      expect(mockToastError).toHaveBeenCalledWith(
        'Your account has been suspended',
      );
    });

    it("never shows the moderator's own words", () => {
      drive({
        subtype: UserSubtype.Banned,
        reasonCode: ModerationReasonCode.Moderator,
        reason: 'Spamming the catalog',
      });

      expect(mockToastError).toHaveBeenCalledWith(
        'Your account has been banned',
      );
      expect(mockToastError).not.toHaveBeenCalledWith(
        expect.stringContaining('Spamming'),
      );
    });

    it('falls back to the subtype when the code is one this build predates', () => {
      drive({ subtype: UserSubtype.Banned, reasonCode: 'POLICY_VIOLATION' });

      expect(mockToastError).toHaveBeenCalledWith(
        'Your account has been banned',
      );
    });
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
