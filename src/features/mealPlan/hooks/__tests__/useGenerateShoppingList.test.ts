'use no memo';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackEvent: jest.fn(),
    trackError: jest.fn(),
  },
}));

// The cache update callbacks read connection shapes that aren't worth modeling
// for the offline guard — stub the updaters so the online path doesn't throw.
jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToQueryConnectionUpdater: jest.fn(() => jest.fn()),
  createAddToParentArrayUpdater: jest.fn(() => jest.fn()),
}));

import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { GenerateShoppingListFromMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import { useGenerateShoppingList } from '../useGenerateShoppingList';

function generateMock() {
  return recordMock(GenerateShoppingListFromMealPlanDocument, {
    data: {
      generateShoppingListFromMealPlan: {
        __typename: 'GenerateShoppingListFromMealPlanPayload',
        shoppingList: {
          __typename: 'ShoppingList',
          id: 'list-1',
          name: 'Groceries',
          isDefault: false,
          totalItems: 4,
          completedItems: 0,
          homeId: null,
          home: null,
          ownerships: [],
        },
      },
    },
  });
}

describe('useGenerateShoppingList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when the API is unavailable', () => {
    afterEach(() => {
      useStore.setState({ apiReachable: true, isOnline: true });
    });

    it('exposes isApiUnavailable, toasts, returns null, and skips the mutation', async () => {
      useStore.setState({ apiReachable: false });
      const generate = generateMock();
      const { result } = renderHookWithApollo(
        () => useGenerateShoppingList('plan-1'),
        { operationMocks: [generate.mock] },
      );

      expect(result.current.isApiUnavailable).toBe(true);

      const response = await result.current.generateShoppingList({
        checkPantry: true,
      });

      expect(response).toBeNull();
      expect(toastService.error).toHaveBeenCalledWith('Not available offline');
      expect(generate.fired).toHaveLength(0);
    });

    it('fires the mutation normally when online', async () => {
      const generate = generateMock();
      const { result } = renderHookWithApollo(
        () => useGenerateShoppingList('plan-1'),
        { operationMocks: [generate.mock] },
      );

      expect(result.current.isApiUnavailable).toBe(false);

      await result.current.generateShoppingList({ checkPantry: true });

      expect(generate.fired).toHaveLength(1);
    });
  });
});
