import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  renderHookWithApollo,
  seedCache,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  ToggleShoppingListItemPurchasedDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  moveShoppingListItemToPurchased,
  moveShoppingListItemToUnpurchased,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { useToggleShoppingItem } from '../useToggleShoppingItem';

const mockHandleApolloError = jest.fn(() => ({ message: 'Toggle error' }));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: mockHandleApolloError,
  }),
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  moveShoppingListItemToPurchased: jest.fn(),
  moveShoppingListItemToUnpurchased: jest.fn(),
}));

jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: {
    save: jest.fn(),
    clear: jest.fn(),
    // track() returns the clearPersistence callback recordPurchase invokes.
    track: jest.fn(() => jest.fn()),
  },
}));

jest.mock('#/utils/isNetworkError', () => ({
  isNetworkError: jest.fn(() => false),
}));

const mockAlert = jest.fn();
jest.mock('#/services/alertService', () => ({
  alertService: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('#/utils/finallyHelpers');

beforeEach(() => {
  jest.clearAllMocks();
});

function createToggleMock(
  recorded: Array<Record<string, unknown>>,
  responseItem: Record<string, unknown>,
): MockedResponse {
  return {
    request: {
      query: ToggleShoppingListItemPurchasedDocument,
      variables: vars => {
        recorded.push(vars);
        return true;
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: {
      data: {
        toggleShoppingListItemPurchased: {
          __typename: 'ToggleShoppingListItemPurchasedPayload',
          success: true,
          message: '',
          code: 'SUCCESS',
          shoppingListItem: responseItem,
        },
      },
    },
  };
}

describe('useToggleShoppingItem', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('returns toggleItem function', () => {
    const { result } = renderHookWithApollo(() =>
      useToggleShoppingItem({
        listId: 'list-1',
        refetch: mockRefetch,
      }),
    );

    expect(typeof result.current.toggleItem).toBe('function');
  });

  it('returns false when listId is null', async () => {
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () =>
        useToggleShoppingItem({
          listId: null,
          refetch: mockRefetch,
        }),
      {
        operationMocks: [
          createToggleMock(recorded, {
            __typename: 'ShoppingListItem',
            id: 'item-1',
          }),
        ],
      },
    );

    let toggleResult!: Awaited<ReturnType<typeof result.current.toggleItem>>;
    await act(async () => {
      toggleResult = await result.current.toggleItem('item-1');
    });

    expect(toggleResult).toBe(false);
    expect(recorded).toEqual([]);
  });

  it('returns false when item is not found in cache', async () => {
    // No cache seeding — readFragment will return null, hook bails out.
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () =>
        useToggleShoppingItem({
          listId: 'list-1',
          refetch: mockRefetch,
        }),
      {
        operationMocks: [
          createToggleMock(recorded, {
            __typename: 'ShoppingListItem',
            id: 'non-existent',
          }),
        ],
      },
    );

    let toggleResult!: Awaited<ReturnType<typeof result.current.toggleItem>>;
    await act(async () => {
      toggleResult = await result.current.toggleItem('non-existent');
    });

    expect(toggleResult).toBe(false);
    expect(recorded).toEqual([]);
  });
});

// Reads just the purchased flag to assert the optimistic move + revert.
const PURCHASE_INFO_FRAGMENT = gql`
  fragment _TestPurchaseInfo on ShoppingListItem {
    id
    purchaseInfo {
      isPurchased
    }
  }
`;

// Full useToggleShoppingItem_item shape so cache.readFragment is `complete`.
function seedShoppingItem() {
  return seedCache([
    {
      __typename: 'ShoppingListItem',
      id: 'item-1',
      itemName: 'Milk',
      quantity: 1,
      quantityInput: '1',
      displayFormat: 'DECIMAL',
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo',
        isPurchased: false,
      },
      version: 3,
      updatedAt: '2026-01-01T00:00:00.000Z',
      category: null,
      notes: null,
      unitName: null,
      unit: null,
      sortOrder: '1',
      item: null,
    },
  ]);
}

const readPurchased = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ purchaseInfo: { isPurchased: boolean } }>({
    id: 'ShoppingListItem:item-1',
    fragment: PURCHASE_INFO_FRAGMENT,
  })?.purchaseInfo?.isPurchased;

function updatePurchaseMock(
  recorded: Array<Record<string, unknown>>,
  outcome: 'success' | 'reject',
): MockedResponse {
  return {
    request: {
      query: UpdateShoppingListItemDocument,
      variables: vars => {
        recorded.push(vars);
        return true;
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: {
      data: {
        updateShoppingListItem:
          outcome === 'success'
            ? {
                __typename: 'UpdateShoppingListItemPayload',
                shoppingListItem: {
                  __typename: 'ShoppingListItem',
                  id: 'item-1',
                  // Recording a purchase through `purchaseTracking` writes a
                  // purchase row server-side, so the summary and the amounts
                  // move with the response — the mutation selects both so the
                  // detail screen doesn't need its own refetch to catch up.
                  purchaseHistory: {
                    __typename: 'PurchaseHistorySummary',
                    previouslyPurchased: true,
                    purchaseCount: 2,
                    lastPurchaseDate: '2026-08-19T00:00:00.000Z',
                  },
                  purchaseInfo: {
                    __typename: 'ShoppingListItemPurchaseInfo',
                    isPurchased: true,
                    purchasedQuantity: 2,
                    purchasedPrice: 4.5,
                    purchaseDate: '2026-08-19T00:00:00.000Z',
                    purchasedBy: {
                      __typename: 'User',
                      id: 'user-1',
                      profile: {
                        __typename: 'UserProfile',
                        id: 'profile-1',
                        displayName: 'Sam',
                        avatar: null,
                      },
                    },
                  },
                },
              }
            : {
                __typename: 'ConflictError',
                code: 'CONFLICT',
                message: 'conflict',
              },
      },
    },
  };
}

describe('useToggleShoppingItem — recordPurchase', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('optimistically marks purchased and fires purchaseTracking with the version', async () => {
    const recorded: Array<Record<string, unknown>> = [];
    const cache = seedShoppingItem();
    const { result } = renderHookWithApollo(
      () => useToggleShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      { cache, operationMocks: [updatePurchaseMock(recorded, 'success')] },
    );

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.recordPurchase('item-1', {
        purchasedQuantity: 2,
        purchasedPrice: 4.5,
      });
    });

    expect(ok).toBe(true);
    // Optimistic move to the purchased connection + purchaseInfo flip.
    expect(moveShoppingListItemToPurchased).toHaveBeenCalledWith(
      expect.anything(),
      'list-1',
      { id: 'item-1' },
    );
    expect(readPurchased(cache)).toBe(true);
    // The mutation carried the cached snapshot version + entered amounts.
    expect(recorded).toContainEqual({
      input: {
        id: 'item-1',
        version: 3,
        purchaseTracking: {
          isPurchased: true,
          purchasedQuantity: 2,
          purchasedPrice: 4.5,
        },
      },
    });
    expect(moveShoppingListItemToUnpurchased).not.toHaveBeenCalled();
  });

  it("writes the server's purchase summary and amounts into the cache", async () => {
    const recorded: Array<Record<string, unknown>> = [];
    const cache = seedShoppingItem();
    const { result } = renderHookWithApollo(
      () => useToggleShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      { cache, operationMocks: [updatePurchaseMock(recorded, 'success')] },
    );

    await act(async () => {
      await result.current.recordPurchase('item-1', {
        purchasedQuantity: 2,
        purchasedPrice: 4.5,
      });
    });

    // Assert the cache, not the mock: this route moves `purchaseCount` and the
    // amounts server-side, and ItemDetail reads them straight from the
    // normalized entity. Before the mutation selected them the entity kept the
    // pre-purchase count and no amounts at all.
    const entity = cache.extract()['ShoppingListItem:item-1'] as {
      purchaseHistory?: Record<string, unknown>;
      purchaseInfo?: Record<string, unknown>;
    };
    expect(entity.purchaseHistory).toMatchObject({
      previouslyPurchased: true,
      purchaseCount: 2,
      lastPurchaseDate: '2026-08-19T00:00:00.000Z',
    });
    expect(entity.purchaseInfo).toMatchObject({
      isPurchased: true,
      purchasedQuantity: 2,
      purchasedPrice: 4.5,
    });
  });

  it('omits purchasedPrice when null and reverts on a resolved rejection', async () => {
    const recorded: Array<Record<string, unknown>> = [];
    const cache = seedShoppingItem();
    const { result } = renderHookWithApollo(
      () => useToggleShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      { cache, operationMocks: [updatePurchaseMock(recorded, 'reject')] },
    );

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.recordPurchase('item-1', {
        purchasedQuantity: 2,
        purchasedPrice: null,
      });
    });

    expect(ok).toBe(false);
    // A null price is dropped so the server auto-derives it.
    expect(recorded[0]).toEqual({
      input: {
        id: 'item-1',
        version: 3,
        purchaseTracking: { isPurchased: true, purchasedQuantity: 2 },
      },
    });
    // The resolved error-union rejection reverts the optimistic purchase.
    expect(moveShoppingListItemToUnpurchased).toHaveBeenCalledWith(
      expect.anything(),
      'list-1',
      { id: 'item-1' },
    );
    expect(readPurchased(cache)).toBe(false);
    expect(mockAlert).toHaveBeenCalledTimes(1);
  });
});
