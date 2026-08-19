import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { MoveShoppingItemToPantryDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type { ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { StorageState } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import { useMoveToPantry } from '../useMoveToPantry';

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackEvent: jest.fn(),
    // errorService.reportError routes through this on the failure path.
    trackError: jest.fn(),
  },
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  removeItemFromShoppingListForMoveToPantry: jest.fn(),
}));

jest.mock('#/utils/finallyHelpers');

beforeEach(() => {
  jest.clearAllMocks();
});

function createItem(
  overrides: Partial<ShoppingListItemDisplayFragment> = {},
): ShoppingListItemDisplayFragment {
  return {
    __typename: 'ShoppingListItem',
    id: 'item-1',
    itemName: 'Milk',
    quantity: 2,
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: true,
    },
    version: 1,
    ...overrides,
  } as Partial<ShoppingListItemDisplayFragment> as ShoppingListItemDisplayFragment;
}

function moveMock() {
  return recordMock(MoveShoppingItemToPantryDocument, {
    data: {
      moveShoppingItemToPantry: {
        __typename: 'MoveShoppingItemToPantryPayload',
        pantryItem: { __typename: 'PantryItem', id: 'pantry-item-1' },
      },
    },
  });
}

describe('useMoveToPantry', () => {
  it('returns moveToPantry function and loading state', () => {
    const { result } = renderHookWithApollo(() =>
      useMoveToPantry({ currentListId: 'list-1' }),
    );

    expect(typeof result.current.moveToPantry).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('calls mutation with correct variables', async () => {
    const move = moveMock();
    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [move.mock] },
    );

    let moveResult: boolean = false;
    await act(async () => {
      moveResult = await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 2,
        removeFromList: true,
      });
    });

    expect(move.fired).toContainEqual({
      input: {
        shoppingListItemId: 'item-1',
        pantryId: 'pantry-1',
        actualQuantity: 2,
        actualUnitId: undefined,
        storageState: undefined,
        expiresAt: undefined,
        removeFromList: true,
        actualPrice: undefined,
        notes: undefined,
      },
    });
    expect(moveResult).toBe(true);
  });

  it('passes optional fields to mutation', async () => {
    const move = moveMock();
    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 3,
        actualUnitId: 'unit-2',
        storageState: StorageState.Frozen,
        expiresAt: '2024-12-31',
        removeFromList: false,
        actualPrice: 5.99,
        notes: 'Keep frozen',
      });
    });

    expect(move.fired).toContainEqual({
      input: expect.objectContaining({
        actualUnitId: 'unit-2',
        storageState: 'FROZEN',
        expiresAt: '2024-12-31',
        removeFromList: false,
        actualPrice: 5.99,
        notes: 'Keep frozen',
      }),
    });
  });

  // `errorPolicy: 'all'` resolves a transport failure with `error` set rather
  // than rejecting, so this drives the outcome the app actually gets.
  it('returns false when the move fails', async () => {
    const failing = recordMock(MoveShoppingItemToPantryDocument, {
      error: new Error('network down'),
    });

    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [failing.mock] },
    );

    let moveResult: boolean = false;
    await act(async () => {
      moveResult = await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 1,
        removeFromList: true,
      });
    });

    expect(moveResult).toBe(false);
  });

  it('accepts onSuccess callback', () => {
    const mockOnSuccess = jest.fn();
    const { result } = renderHookWithApollo(() =>
      useMoveToPantry({ currentListId: 'list-1', onSuccess: mockOnSuccess }),
    );

    expect(typeof result.current.moveToPantry).toBe('function');
  });

  it('tracks telemetry event on successful move', async () => {
    const { Telemetry } = require('#/services/telemetry');
    const move = moveMock();

    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 1,
        removeFromList: true,
      });
    });

    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'shopping_item_moved_to_pantry',
      expect.objectContaining({
        shopping_list_id: 'list-1',
        pantry_id: 'pantry-1',
        remove_from_list: true,
      }),
    );
  });

  describe('when the API is unavailable', () => {
    afterEach(() => {
      useStore.setState({ apiReachable: true, isOnline: true });
    });

    it('exposes isApiUnavailable, toasts, returns false, and skips the mutation', async () => {
      useStore.setState({ apiReachable: false });
      const errorSpy = jest.spyOn(toastService, 'error');
      const move = moveMock();
      const { result } = renderHookWithApollo(
        () => useMoveToPantry({ currentListId: 'list-1' }),
        { operationMocks: [move.mock] },
      );

      expect(result.current.isApiUnavailable).toBe(true);

      let moveResult: boolean = true;
      await act(async () => {
        moveResult = await result.current.moveToPantry(createItem(), {
          pantryId: 'pantry-1',
          actualQuantity: 2,
          removeFromList: true,
        });
      });

      expect(moveResult).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('Not available offline');
      expect(move.fired).toHaveLength(0);
    });

    it('fires the mutation normally when online', async () => {
      const move = moveMock();
      const { result } = renderHookWithApollo(
        () => useMoveToPantry({ currentListId: 'list-1' }),
        { operationMocks: [move.mock] },
      );

      expect(result.current.isApiUnavailable).toBe(false);

      await act(async () => {
        await result.current.moveToPantry(createItem(), {
          pantryId: 'pantry-1',
          actualQuantity: 2,
          removeFromList: true,
        });
      });

      expect(move.fired).toHaveLength(1);
    });
  });
});
