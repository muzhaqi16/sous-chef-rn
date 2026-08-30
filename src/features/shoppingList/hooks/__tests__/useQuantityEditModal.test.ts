import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { UpdateShoppingListItemQuantityDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type { ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { DisplayFormat, ErrorCode } from '#/graphql/generated/schemaTypes';
import { useQuantityEditModal } from '../useQuantityEditModal';

function updateMock() {
  return recordMock(UpdateShoppingListItemQuantityDocument, {
    data: {
      updateShoppingListItemQuantity: {
        __typename: 'UpdateShoppingListItemQuantityPayload',
        shoppingListItem: { __typename: 'ShoppingListItem', id: 'item-1' },
      },
    },
  });
}

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackEvent: jest.fn(),
  },
}));

const mockAlert = jest.fn();
jest.mock('#/services/alertService', () => ({
  alertService: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#utils/imageUtils', () => ({
  resolveImageUrl: jest.fn(() => null),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function createItem(
  overrides: Partial<ShoppingListItemDisplayFragment> = {},
): ShoppingListItemDisplayFragment {
  return {
    __typename: 'ShoppingListItem',
    id: 'item-1',
    shoppingList: { __typename: 'ShoppingList', id: 'list-1' },
    itemName: 'Milk',
    quantity: 2,
    quantityInput: '2',
    displayFormat: DisplayFormat.Auto,
    version: 3,
    updatedAt: '2025-01-01T00:00:00.000Z',
    category: 'Dairy',
    notes: null,
    unitName: 'gallon',
    sortOrder: 'aaa',
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      movedToPantryAt: null,
      isPurchased: false,
    },
    unit: { __typename: 'Unit', id: 'unit-1', name: 'gallon', symbol: 'gal' },
    item: null,
    ...overrides,
  };
}

describe('useQuantityEditModal', () => {
  it('returns initial state with modal closed', () => {
    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items: [createItem()] }),
    );

    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('opens modal for an item', () => {
    const items = [createItem()];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.visible).toBe(true);
    expect(result.current.selectedItem).not.toBeNull();
    expect(result.current.selectedItem!.id).toBe('item-1');
    expect(result.current.selectedItem!.itemName).toBe('Milk');
  });

  it('does not open modal when item not found', () => {
    const items = [createItem()];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('non-existent');
    });

    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
  });

  it('transforms item to QuantityEditItem format', () => {
    const items = [createItem()];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    const item = result.current.selectedItem!;
    expect(item.id).toBe('item-1');
    expect(item.itemName).toBe('Milk');
    expect(item.quantity).toBe(2);
    expect(item.unitName).toBe('gal'); // uses unit.symbol
    expect(item.unitId).toBe('unit-1');
    expect(item.category).toBe('Dairy');
    expect(item.version).toBe(3);
  });

  it('includes itemUnits when unit exists', () => {
    const items = [createItem()];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem!.itemUnits).toHaveLength(1);
    expect(result.current.selectedItem!.itemUnits[0]).toEqual(
      expect.objectContaining({
        id: 'unit-1',
        symbol: 'gal',
        name: 'gallon',
        isDefault: true,
        isPreferred: true,
      }),
    );
  });

  it('returns empty itemUnits when item has no unit', () => {
    const items = [createItem({ unit: null })];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem!.itemUnits).toEqual([]);
  });

  it('closes the modal', () => {
    const items = [createItem()];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.visible).toBe(true);

    act(() => {
      result.current.close();
    });

    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
  });

  it('saves quantity changes via mutation', async () => {
    const m = updateMock();
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('5', 'gal', 'unit-1');
    });

    expect(m.fired).toContainEqual({
      input: {
        itemId: 'item-1',
        quantity: '5',
        unitId: 'unit-1',
        version: 3,
      },
    });
  });

  it('sends a comma decimal to the API with the separator normalized', async () => {
    const m = recordMock(UpdateShoppingListItemQuantityDocument, {
      data: {
        updateShoppingListItemQuantity: {
          __typename: 'UpdateShoppingListItemQuantityPayload',
          shoppingListItem: { __typename: 'ShoppingListItem', id: 'item-1' },
        },
      },
    });
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('1,5', 'gal', 'unit-1');
    });

    expect(m.fired[0]).toEqual({
      input: {
        itemId: 'item-1',
        quantity: '1.5',
        unitId: 'unit-1',
        version: 3,
      },
    });
  });

  it('passes a mixed number through untouched', async () => {
    const m = recordMock(UpdateShoppingListItemQuantityDocument, {
      data: {
        updateShoppingListItemQuantity: {
          __typename: 'UpdateShoppingListItemQuantityPayload',
          shoppingListItem: { __typename: 'ShoppingListItem', id: 'item-1' },
        },
      },
    });
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('2 1/3', 'gal', 'unit-1');
    });

    expect(m.fired[0]).toEqual({
      input: {
        itemId: 'item-1',
        quantity: '2 1/3',
        unitId: 'unit-1',
        version: 3,
      },
    });
  });

  it('keeps the sheet open and alerts when the server refuses the quantity', async () => {
    const m = recordMock(UpdateShoppingListItemQuantityDocument, {
      data: {
        updateShoppingListItemQuantity: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          message: 'Invalid fraction format',
          field: 'quantity',
        },
      },
    });
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('nonsense', null, null);
    });

    expect(result.current.visible).toBe(true);
    expect(result.current.selectedItem).not.toBeNull();
    // A refusal payload resolves with no `error`, so `onError` never fires and
    // this hook is the only alerter — again exactly one.
    expect(mockAlert).toHaveBeenCalledTimes(1);
    // Copy for the field the refusal named, in the app's own words — the
    // server's "Invalid fraction format" is English and is never shown.
    expect(mockAlert).toHaveBeenCalledWith(
      'Error',
      "That quantity isn't valid. Try a number like 2, 0.5 or 1 1/2.",
    );
  });

  // The two failure routes must produce exactly ONE message between them.
  // A resolved transport error already reaches the user through the mutation's
  // `onError`, so this hook must stay quiet — `alertRejectedMutation` suppresses
  // precisely the `result.error` case for callers that keep an `onError`.
  it('does not add a second alert when the failure already went through onError', async () => {
    const m = recordMock(UpdateShoppingListItemQuantityDocument, {
      error: new Error('network down'),
    });
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('5', null, null);
    });

    // ONE alert, and it is `onError`'s — not a second one from this hook.
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert).not.toHaveBeenCalledWith(
      'Error',
      'Could not adjust the quantity.',
    );
    // Still a failure: the sheet stays open with the typed value intact.
    expect(result.current.visible).toBe(true);
  });

  // Offline, the mutation resolves with the field null — queueLink's shape for
  // "queued for replay". That is an acceptance, not a failure: `SyncShoppingListItem`
  // replays it later, so the sheet must close silently rather than alert.
  it('closes without alerting when the write is queued offline', async () => {
    const m = recordMock(UpdateShoppingListItemQuantityDocument, {
      data: { updateShoppingListItemQuantity: null },
    });
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('5', null, null);
    });

    expect(mockAlert).not.toHaveBeenCalled();
    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
  });

  it('closes modal after successful save', async () => {
    const m = updateMock();
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('5', null, null);
    });

    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
  });

  it('does nothing when save called without selected item', async () => {
    const m = updateMock();
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.save('5', null, null);
    });

    expect(m.fired).toEqual([]);
  });

  it('defaults quantity to 0 when item.quantity is null', () => {
    const items = [createItem({ quantity: null })];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem!.quantity).toBe(0);
  });

  it('defaults itemName to "Item" when missing', () => {
    const items = [createItem({ itemName: '' })];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem!.itemName).toBe('Item');
  });

  it('uses unitName when unit.symbol is not available', () => {
    const items = [createItem({ unit: null, unitName: 'kilogram' })];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem!.unitName).toBe('kilogram');
  });
});
