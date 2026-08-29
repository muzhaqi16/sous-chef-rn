import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { UpdateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { UseShoppingListBudget_ListFragmentDoc } from '../useShoppingListBudget.generated';
import type { RootState } from '#store';
import { useShoppingListBudget } from '../useShoppingListBudget';

// useIsApiUnavailable reads the network signals off the root store, so the state
// is mutable per test — `apiReachable: false` is what the online-only gate keys
// on.
const mockStoreState = {
  isOnline: true,
  apiReachable: true,
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (s: RootState) => unknown) =>
    selector(mockStoreState as RootState),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.isOnline = true;
  mockStoreState.apiReachable = true;
});

const LIST = {
  __typename: 'ShoppingList',
  id: 'list-1',
  budgetAmount: null,
  currency: 'USD',
  priceTracking: false,
  version: 1,
  updatedAt: '2026-01-01T00:00:00Z',
};

const readBudget = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ budgetAmount: number | null; priceTracking: boolean }>({
    id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
    fragment: UseShoppingListBudget_ListFragmentDoc,
    fragmentName: 'useShoppingListBudget_list',
  });

// The whole UpdateShoppingListPayload selection, so the server's values
// normalize into the cache by `__typename + id` with no `update` callback —
// that reconciliation is what replaces the removed optimistic write.
const successMock = (patch: {
  budgetAmount?: number | null;
  currency?: string | null;
  priceTracking?: boolean;
}) =>
  recordMock(UpdateShoppingListDocument, {
    data: {
      updateShoppingList: {
        __typename: 'UpdateShoppingListPayload',
        shoppingList: {
          __typename: 'ShoppingList',
          id: 'list-1',
          name: 'Groceries',
          isDefault: false,
          status: 'ACTIVE',
          isCompleted: false,
          completedShopDate: null,
          budgetAmount: null,
          currency: 'USD',
          priceTracking: false,
          totalCost: 0,
          estimatedTotal: 0,
          totalItems: 0,
          completedItems: 0,
          remainingItems: 0,
          completionRate: 0,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          ownerships: [],
          ...patch,
        },
      },
    },
  });

const rejectionMock = () =>
  recordMock(UpdateShoppingListDocument, {
    data: {
      updateShoppingList: {
        __typename: 'ValidationError',
        code: 'VALIDATION_ERROR',
        message: 'negative budget',
        field: 'budgetAmount',
      },
    },
  });

describe('useShoppingListBudget', () => {
  it('setBudget writes the value before firing and sends the cached version', async () => {
    const cache = seedCache([LIST]);
    const update = successMock({ budgetAmount: 150 });
    const { result } = renderHookWithApollo(() => useShoppingListBudget(), {
      cache,
      operationMocks: [update.mock],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      const promise = result.current.setBudget('list-1', 150);
      // Durable: the kit writes the value permanently before firing, so it is
      // on screen while the request is in flight and survives being queued.
      expect(readBudget(cache)?.budgetAmount).toBe(150);
      resolved = await promise;
    });

    expect(resolved).toBe(true);
    expect(update.fired).toContainEqual({
      input: {
        id: 'list-1',
        planning: { budgetAmount: 150 },
        version: 1,
        idempotencyKey: expect.any(String),
      },
    });
    await waitFor(() => {
      expect(readBudget(cache)?.budgetAmount).toBe(150);
    });
  });

  it('setPriceTracking sends the settings sub-input and takes the server value', async () => {
    const cache = seedCache([LIST]);
    const update = successMock({ priceTracking: true });
    const { result } = renderHookWithApollo(() => useShoppingListBudget(), {
      cache,
      operationMocks: [update.mock],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.setPriceTracking('list-1', true);
    });

    expect(resolved).toBe(true);
    expect(update.fired).toContainEqual({
      input: {
        id: 'list-1',
        settings: { priceTracking: true },
        version: 1,
        // Claimed before the server's version check, so a queued replay
        // converges rather than being refused on its stale version.
        idempotencyKey: expect.any(String),
      },
    });
    await waitFor(() => {
      expect(readBudget(cache)?.priceTracking).toBe(true);
    });
  });

  it('returns false on a rejection and leaves the cached budget alone', async () => {
    const cache = seedCache([LIST]);
    const update = rejectionMock();
    const { result } = renderHookWithApollo(() => useShoppingListBudget(), {
      cache,
      operationMocks: [update.mock],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.setBudget('list-1', -5);
    });

    expect(resolved).toBe(false);
    // Nothing was written optimistically, so there is nothing to revert.
    expect(readBudget(cache)?.budgetAmount).toBeNull();
  });

  it('writes the budget through offline and keeps it', async () => {
    // Durable, not refused: this shares a Save button with the list rename,
    // which goes through the same mutation and queues. Refusing one half of a
    // press while the other queued is what this replaces.
    mockStoreState.apiReachable = false;
    const cache = seedCache([LIST]);
    const update = successMock({ budgetAmount: 150 });
    const { result } = renderHookWithApollo(() => useShoppingListBudget(), {
      cache,
      operationMocks: [update.mock],
    });

    let budgetResolved: boolean | undefined;
    await act(async () => {
      budgetResolved = await result.current.setBudget('list-1', 150);
    });

    expect(budgetResolved).toBe(true);
    expect(readBudget(cache)?.budgetAmount).toBe(150);
  });
});
