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

jest.mock('#/services/errorService');

// Spread the real module: only the two connection movers are stubbed. The
// purchase-record writer must be the real one, because these tests assert on
// what it leaves in the cache — and a partial factory silently makes any export
// the hook reaches next `undefined`.
jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  ...jest.requireActual('#/apollo/utils/shoppingListCacheUpdaters'),
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
        // The snapshot fragment selects it, so a fixture without it makes the
        // strict read incomplete and the hook refuse the toggle. The rest are
        // here for the same reason: `writePurchaseInfo` carries the cached
        // record forward, so whatever the fixture omits it writes back partial.
        movedToPantryAt: null,
        purchaseDate: null,
        purchasedById: null,
        purchasedPrice: null,
        purchasedQuantity: null,
        purchasedBy: null,
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

// The sentence the API returns when a purchase has no name to record against
// (the row's catalog item was hard-deleted and it carries no name of its own).
// Server-authored English — the fixture carries it, and the app never shows it.
const NAMELESS_ROW_MESSAGE =
  'This item has no name to record a purchase against. Add a name first.';

// What the user actually sees: the app's own copy for `field: 'itemName'`.
const ITEM_NAME_COPY = 'Enter a name for this item.';

// Toggle twin of updatePurchaseMock's 'fieldRefusal' outcome.
function toggleFieldRefusalMock(): MockedResponse {
  return {
    request: {
      query: ToggleShoppingListItemPurchasedDocument,
      variables: () => true,
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: {
      data: {
        toggleShoppingListItemPurchased: {
          __typename: 'ValidationError',
          code: 'VALIDATION_ERROR',
          message: NAMELESS_ROW_MESSAGE,
          field: 'itemName',
        },
      },
    },
  };
}

function updatePurchaseMock(
  recorded: Array<Record<string, unknown>>,
  outcome: 'success' | 'reject' | 'fieldRefusal',
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
            : outcome === 'fieldRefusal'
            ? {
                __typename: 'ValidationError',
                code: 'VALIDATION_ERROR',
                message: NAMELESS_ROW_MESSAGE,
                field: 'itemName',
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

  it('shows copy for the field the refusal names', async () => {
    const recorded: Array<Record<string, unknown>> = [];
    const cache = seedShoppingItem();
    const { result } = renderHookWithApollo(
      () => useToggleShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      { cache, operationMocks: [updatePurchaseMock(recorded, 'fieldRefusal')] },
    );

    await act(async () => {
      await result.current.recordPurchase('item-1', {
        purchasedQuantity: 2,
        purchasedPrice: null,
      });
    });

    expect(readPurchased(cache)).toBe(false);
    expect(mockAlert).toHaveBeenCalledWith(expect.anything(), ITEM_NAME_COPY);
    // Never the server's English, however specific it is.
    expect(mockAlert).not.toHaveBeenCalledWith(
      expect.anything(),
      NAMELESS_ROW_MESSAGE,
    );
  });

  it('shows it on the plain toggle too', async () => {
    const cache = seedShoppingItem();
    const { result } = renderHookWithApollo(
      () => useToggleShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      { cache, operationMocks: [toggleFieldRefusalMock()] },
    );

    let toggled!: Awaited<ReturnType<typeof result.current.toggleItem>>;
    await act(async () => {
      toggled = await result.current.toggleItem('item-1');
    });

    expect(toggled).toBe(false);
    expect(readPurchased(cache)).toBe(false);
    expect(mockAlert).toHaveBeenCalledWith(expect.anything(), ITEM_NAME_COPY);
  });
});

describe('the stocked stamp follows the purchased flag', () => {
  const RECORD = gql`
    fragment ToggleStampProbe on ShoppingListItem {
      id
      purchaseInfo {
        isPurchased
        movedToPantryAt
        purchasedQuantity
      }
    }
  `;

  /**
   * The mutation resolves as QUEUED — a null payload, no error.
   *
   * Without a mock the operation resolves as an unmatched-operation ERROR, so
   * the hook's revert races the next toggle and the assertion sees whichever
   * won. These tests are about what the local write leaves behind, and queued
   * is the case where that is all there is.
   */
  const queued: MockedResponse = {
    request: {
      query: UpdateShoppingListItemDocument,
      variables: () => true,
    },
    result: { data: { updateShoppingListItem: null } },
    maxUsageCount: Number.POSITIVE_INFINITY,
  };

  /**
   * The same for the TOGGLE mutation, which `toggleItem` actually fires.
   *
   * Without it the operation is unmatched, resolves as an error, and the hook
   * REVERTS — so every assertion below describes the post-revert state while
   * claiming to describe the flip, and passes only if the revert clears the
   * stamp too, which is the defect they were written to catch.
   */
  const toggleQueued: MockedResponse = {
    request: {
      query: ToggleShoppingListItemPurchasedDocument,
      variables: () => true,
    },
    result: { data: { toggleShoppingListItemPurchased: null } },
    maxUsageCount: Number.POSITIVE_INFINITY,
  };

  /** A line that was purchased AND already moved into the pantry. */
  function seedStockedItem() {
    const cache = seedShoppingItem();
    cache.writeFragment({
      id: 'ShoppingListItem:item-1',
      fragment: RECORD,
      data: {
        __typename: 'ShoppingListItem',
        id: 'item-1',
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: true,
          movedToPantryAt: '2026-08-28T10:00:00.000Z',
          purchasedQuantity: 3,
        },
      },
    });
    return cache;
  }

  const readRecord = (cache: ReturnType<typeof seedCache>) =>
    cache.readFragment<{
      purchaseInfo: {
        isPurchased: boolean;
        movedToPantryAt: string | null;
        purchasedQuantity: number | null;
      };
    }>({ id: 'ShoppingListItem:item-1', fragment: RECORD })?.purchaseInfo;

  it('clears the stamp when the line is un-purchased', async () => {
    const cache = seedStockedItem();
    const { result } = renderHookWithApollo(
      () => useToggleShoppingItem({ listId: 'list-1', refetch: jest.fn() }),
      { cache, operationMocks: [queued, toggleQueued] },
    );

    await act(async () => {
      await result.current.toggleItem('item-1');
    });

    // The server clears the stamp on exactly this transition, so a line the
    // user just un-checked must stop reading as "already in your pantry" —
    // otherwise its row withholds the move-to-pantry action for a line the
    // bulk move WILL act on.
    expect(readRecord(cache)?.movedToPantryAt).toBeNull();
  });

  it('does not resurrect the stamp when the line is re-purchased', async () => {
    const cache = seedStockedItem();
    const { result } = renderHookWithApollo(
      () => useToggleShoppingItem({ listId: 'list-1', refetch: jest.fn() }),
      { cache, operationMocks: [queued, toggleQueued] },
    );

    await act(async () => {
      await result.current.toggleItem('item-1');
    });
    await act(async () => {
      await result.current.toggleItem('item-1');
    });

    expect(readRecord(cache)?.isPurchased).toBe(true);
    expect(readRecord(cache)?.movedToPantryAt).toBeNull();
  });

  it('leaves the rest of the purchase record alone on a flip', async () => {
    const cache = seedStockedItem();
    const { result } = renderHookWithApollo(
      () => useToggleShoppingItem({ listId: 'list-1', refetch: jest.fn() }),
      { cache, operationMocks: [queued, toggleQueued] },
    );

    await act(async () => {
      await result.current.toggleItem('item-1');
    });

    // Only the stamp is derived from the flag. The amounts belong to the
    // purchase the server recorded and are not this write's to discard.
    expect(readRecord(cache)?.purchasedQuantity).toBe(3);
  });
});
