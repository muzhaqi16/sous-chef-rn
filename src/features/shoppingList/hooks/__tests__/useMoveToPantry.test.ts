import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { MoveShoppingItemToPantryDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useMoveToPantry } from '../useMoveToPantry';

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackEvent: jest.fn(),
  },
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  removeItemFromShoppingListForMoveToPantry: jest.fn(),
}));

jest.mock('#/utils/compilerSafeWrappers');

beforeEach(() => {
  jest.clearAllMocks();
});

function createItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    itemName: 'Milk',
    quantity: 2,
    purchaseInfo: { isPurchased: true },
    version: 1,
    ...overrides,
  } as any;
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

    let moveResult: any;
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
        storageState: 'FROZEN' as any,
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

  it('returns false when executeMutation returns false', async () => {
    const { executeMutation } = require('#/utils/compilerSafeWrappers');
    executeMutation.mockResolvedValueOnce(false);

    const { result } = renderHookWithApollo(() =>
      useMoveToPantry({ currentListId: 'list-1' }),
    );

    let moveResult: any;
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
});
