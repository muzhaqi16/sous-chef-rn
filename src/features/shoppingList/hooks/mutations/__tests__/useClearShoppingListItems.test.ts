import { act } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { RemoveItemsFromShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { alertService } from '#/services/alertService';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { toastService } from '#/services/toastService';
import { useClearShoppingListItems } from '../useClearShoppingListItems';

jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn() },
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  clearAllPurchasedItemsFromCache: jest.fn(),
  clearAllUnpurchasedItemsFromCache: jest.fn(),
}));

// Clearing a list is ONLINE-ONLY: nothing is written to the cache ahead of the
// server and nothing queues for replay, so the offline gate is part of the
// hook's contract rather than an incidental detail.
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: jest.fn(() => false),
}));
const mockIsApiUnavailable = useIsApiUnavailable as jest.MockedFunction<
  typeof useIsApiUnavailable
>;

const {
  clearAllPurchasedItemsFromCache: mockClearAllPurchased,
  clearAllUnpurchasedItemsFromCache: mockClearAllUnpurchased,
} = require('#/apollo/utils/shoppingListCacheUpdaters');

beforeEach(() => {
  jest.clearAllMocks();
  mockIsApiUnavailable.mockReturnValue(false);
});

interface TestClearItem {
  id: string;
  itemName: string;
  purchaseInfo: { isPurchased: boolean };
}

function createItem(overrides: Partial<TestClearItem> = {}): TestClearItem {
  return {
    id: 'item-1',
    itemName: 'Milk',
    purchaseInfo: { isPurchased: false },
    ...overrides,
  };
}

function createClearMock(
  recorded: Array<Record<string, unknown>>,
  delay = 0,
): MockedResponse {
  return {
    request: {
      query: RemoveItemsFromShoppingListDocument,
      variables: vars => {
        recorded.push(vars);
        return true;
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    delay,
    result: {
      data: {
        removeItemsFromShoppingList: {
          __typename: 'RemoveItemsFromShoppingListPayload',
          summary: {
            __typename: 'BulkSummary',
            total: 1,
            succeeded: 1,
            failed: 0,
            skipped: 0,
            executionTime: 0,
          },
          shoppingListItems: [{ __typename: 'ShoppingListItem', id: 'item-1' }],
        },
      },
    },
  };
}

function createRejectedClearMock(): MockedResponse {
  return {
    request: {
      query: RemoveItemsFromShoppingListDocument,
      variables: () => true,
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: {
      data: {
        removeItemsFromShoppingList: {
          __typename: 'ValidationError',
          code: 'VALIDATION_ERROR',
          message: 'nope',
          field: 'ids',
        },
      },
    },
  };
}

describe('useClearShoppingListItems', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('returns clearItems function', () => {
    const { result } = renderHookWithApollo(() =>
      useClearShoppingListItems({
        listId: 'list-1',
        unpurchasedItems: [],
        purchasedItems: [],
        refetch: mockRefetch,
      }),
    );

    expect(typeof result.current.clearItems).toBe('function');
  });

  it('does nothing when listId is null', async () => {
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () =>
        useClearShoppingListItems({
          listId: null,
          unpurchasedItems: [],
          purchasedItems: [createItem({ purchaseInfo: { isPurchased: true } })],
          refetch: mockRefetch,
        }),
      { operationMocks: [createClearMock(recorded)] },
    );

    await act(async () => {
      await result.current.clearItems(true);
    });

    expect(recorded).toEqual([]);
    expect(mockClearAllPurchased).not.toHaveBeenCalled();
  });

  it('does nothing when no target items exist (purchased=true but none purchased)', async () => {
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () =>
        useClearShoppingListItems({
          listId: 'list-1',
          unpurchasedItems: [
            createItem({ purchaseInfo: { isPurchased: false } }),
          ],
          purchasedItems: [],
          refetch: mockRefetch,
        }),
      { operationMocks: [createClearMock(recorded)] },
    );

    await act(async () => {
      await result.current.clearItems(true);
    });

    expect(recorded).toEqual([]);
    expect(mockClearAllPurchased).not.toHaveBeenCalled();
  });

  it('fires the mutation and clears purchased items from cache on the response', async () => {
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () =>
        useClearShoppingListItems({
          listId: 'list-1',
          unpurchasedItems: [
            createItem({ id: 'item-2', purchaseInfo: { isPurchased: false } }),
          ],
          purchasedItems: [
            createItem({ id: 'item-1', purchaseInfo: { isPurchased: true } }),
            createItem({ id: 'item-3', purchaseInfo: { isPurchased: true } }),
          ],
          refetch: mockRefetch,
        }),
      { operationMocks: [createClearMock(recorded)] },
    );

    await act(async () => {
      await result.current.clearItems(true);
    });

    expect(mockClearAllPurchased).toHaveBeenCalledWith(
      expect.anything(),
      'list-1',
      ['item-1', 'item-3'],
    );

    // The mutation carries the exact captured ids, not a re-evaluated
    // `purchased` filter, so it deletes only what the tap targeted.
    expect(recorded).toContainEqual({
      input: {
        shoppingListId: 'list-1',
        ids: ['item-1', 'item-3'],
      },
    });
  });

  it('fires the mutation and clears unpurchased items from cache on the response', async () => {
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () =>
        useClearShoppingListItems({
          listId: 'list-1',
          unpurchasedItems: [
            createItem({ id: 'item-1', purchaseInfo: { isPurchased: false } }),
            createItem({ id: 'item-3', purchaseInfo: { isPurchased: false } }),
          ],
          purchasedItems: [
            createItem({ id: 'item-2', purchaseInfo: { isPurchased: true } }),
          ],
          refetch: mockRefetch,
        }),
      { operationMocks: [createClearMock(recorded)] },
    );

    await act(async () => {
      await result.current.clearItems(false);
    });

    expect(mockClearAllUnpurchased).toHaveBeenCalledWith(
      expect.anything(),
      'list-1',
      ['item-1', 'item-3'],
    );

    // Id-based, matching the cleared set.
    expect(recorded).toContainEqual({
      input: {
        shoppingListId: 'list-1',
        ids: ['item-1', 'item-3'],
      },
    });
  });

  it('prevents concurrent calls via isClearingRef guard', async () => {
    // Use a long delay on the mock so the first call is in flight when the
    // second call tries to start. The isClearingRef guard should reject the
    // second call without firing a second mutation.
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () =>
        useClearShoppingListItems({
          listId: 'list-1',
          unpurchasedItems: [],
          purchasedItems: [
            createItem({ id: 'item-1', purchaseInfo: { isPurchased: true } }),
          ],
          refetch: mockRefetch,
        }),
      { operationMocks: [createClearMock(recorded, 100)] },
    );

    const firstCall = act(async () => {
      await result.current.clearItems(true);
    });

    await act(async () => {
      await result.current.clearItems(true);
    });

    await firstCall;

    expect(recorded).toHaveLength(1);
  });

  it('alerts when the clear is rejected (union error) and touches no cache', async () => {
    const { result } = renderHookWithApollo(
      () =>
        useClearShoppingListItems({
          listId: 'list-1',
          unpurchasedItems: [],
          purchasedItems: [
            createItem({ id: 'item-1', purchaseInfo: { isPurchased: true } }),
          ],
          refetch: mockRefetch,
        }),
      { operationMocks: [createRejectedClearMock()] },
    );

    await act(async () => {
      await result.current.clearItems(true);
    });

    // A server refusal surfaces one alert. Nothing was written ahead of the
    // server, so the rows stay put and there is nothing to restore.
    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(mockClearAllPurchased).not.toHaveBeenCalled();
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('refuses the clear offline and leaves the cache alone', async () => {
    mockIsApiUnavailable.mockReturnValue(true);
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () =>
        useClearShoppingListItems({
          listId: 'list-1',
          unpurchasedItems: [],
          purchasedItems: [
            createItem({ id: 'item-1', purchaseInfo: { isPurchased: true } }),
          ],
          refetch: mockRefetch,
        }),
      { operationMocks: [createClearMock(recorded)] },
    );

    expect(result.current.isApiUnavailable).toBe(true);

    await act(async () => {
      await result.current.clearItems(true);
    });

    expect(toastService.error).toHaveBeenCalled();
    expect(recorded).toEqual([]);
    expect(mockClearAllPurchased).not.toHaveBeenCalled();
    expect(alertService.alert).not.toHaveBeenCalled();
  });
});
