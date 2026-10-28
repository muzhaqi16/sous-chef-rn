'use no memo';

import { captureOnData } from '#/test-utils/subscriptionCapture';
import { toastService } from '#/services/toastService';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import type { SubscriptionConfig } from '#/services/subscriptions/types';
import {
  ModerationReasonCode,
  UserSubtype,
} from '#/graphql/generated/schemaTypes';
import { useStore } from '#store/index';
import { getDeviceId } from '#/services/auth/deviceId';
import { onWorkSettled } from '#/services/subscriptions/settledWork';
import { useUserSubscriptions } from '../useUserSubscriptions';

const mockRegister = jest.fn().mockReturnValue({});
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    register: (config: SubscriptionConfig) => mockRegister(config),
  },
}));

const mockToastError = jest.mocked(toastService.error);
const mockToastSuccess = jest.mocked(toastService.success);

jest.mock('#/services/auth/deviceId');

jest.mock('#/services/authService', () => ({
  authService: { logout: jest.fn(() => Promise.resolve()) },
}));

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
  // The screen waiting on the work asks once (API-15) instead of polling.
  it.each([
    [
      UserSubtype.ReceiptParseSettled,
      { receiptParseId: 'parse-1' },
      'receiptParse',
      'parse-1',
    ],
    [
      UserSubtype.RecipeCaptureSettled,
      { recipeCaptureId: 'capture-1' },
      'recipeCapture',
      'capture-1',
    ],
  ] as const)(
    'announces %s for the screen waiting on it',
    (subtype, parents, kind, id) => {
      const settled = jest.fn();
      const stop = onWorkSettled(settled);
      const getOnData = captureOnData(mockRegister);
      renderHookWithApollo(() => useUserSubscriptions('user-1'));

      getOnData()({ __typename: 'UserEvent', subtype, parents });

      expect(settled).toHaveBeenCalledWith({ kind, id });
      stop();
    },
  );

  it('clears every entity selection when removed from the selected home', () => {
    const getOnData = captureOnData(mockRegister);
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
      const getOnData = captureOnData(mockRegister);
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

  describe('an accepted invite announced back', () => {
    const THIS_DEVICE = 'device_this';
    const ADDED = [
      [UserSubtype.AddedToHome, 'You were added to a new home'],
      [UserSubtype.AddedToShoppingList, 'You were added to a shopping list'],
    ];

    const drive = (subtype: string, originatorClientId: string) => {
      jest.mocked(getDeviceId).mockReturnValue(THIS_DEVICE);
      const getOnData = captureOnData(mockRegister);
      renderHookWithApollo(() => useUserSubscriptions('user-1'));
      // The same account either way: only the device tells the two apart.
      getOnData()({
        __typename: 'UserEvent',
        subtype,
        actorUserId: 'user-1',
        originatorClientId,
      });
    };

    it.each(ADDED)(
      'says nothing for %s when this device accepted it',
      subtype => {
        drive(subtype, THIS_DEVICE);

        expect(mockToastSuccess).not.toHaveBeenCalled();
      },
    );

    it.each(ADDED)(
      'announces %s when another device accepted it',
      (subtype, message) => {
        drive(subtype, 'device_other');

        expect(mockToastSuccess).toHaveBeenCalledWith(message);
      },
    );
  });

  describe('a removal', () => {
    const REMOVED: [UserSubtype, Record<string, string>, string][] = [
      [
        UserSubtype.RemovedFromHome,
        { homeId: 'home-1' },
        'You were removed from a home',
      ],
      [
        UserSubtype.RemovedFromShoppingList,
        { shoppingListId: 'list-1' },
        'You were removed from a shopping list',
      ],
    ];

    const drive = (
      subtype: UserSubtype,
      parents: Record<string, string>,
      actorUserId: string,
    ) => {
      const getOnData = captureOnData(mockRegister);
      renderHookWithApollo(() => useUserSubscriptions('user-1'));
      getOnData()({
        __typename: 'UserEvent',
        subtype,
        userId: 'user-1',
        actorUserId,
        parents,
      });
    };

    it.each(REMOVED)(
      'announces %s when someone else made it',
      (subtype, parents, message) => {
        drive(subtype, parents, 'user-owner');

        expect(mockToastError).toHaveBeenCalledWith(message);
      },
    );

    it.each(REMOVED)(
      'says nothing for %s the user made by leaving, and still drops it',
      (subtype, parents) => {
        drive(subtype, parents, 'user-1');

        expect(mockToastError).not.toHaveBeenCalled();
        expect(useStore.getState().selectedShoppingListId).toBeNull();
      },
    );
  });

  it('leaves selections alone when removed from a home that is not selected', () => {
    const getOnData = captureOnData(mockRegister);
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
