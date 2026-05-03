import { renderHook, act } from '@testing-library/react-native';
import { useQuantityEditModal } from '../useQuantityEditModal';

// --- Mocks ---

const mockUpdateQuantity = jest.fn();

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useUpdateShoppingListItemQuantityMutation: () => [mockUpdateQuantity],
}));

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackEvent: jest.fn(),
  },
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#utils/imageUtils', () => ({
  resolveImageUrl: jest.fn(() => null),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function createItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    itemName: 'Milk',
    quantity: 2,
    quantityInput: '2',
    unitName: 'gallon',
    unit: { id: 'unit-1', name: 'gallon', symbol: 'gal' },
    category: 'Dairy',
    version: 3,
    purchaseInfo: { isPurchased: false },
    sortOrder: 'aaa',
    item: null,
    ...overrides,
  } as any;
}

describe('useQuantityEditModal', () => {
  it('returns initial state with modal closed', () => {
    const { result } = renderHook(() =>
      useQuantityEditModal({ items: [createItem()] }),
    );

    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('opens modal for an item', () => {
    const items = [createItem()];

    const { result } = renderHook(() => useQuantityEditModal({ items }));

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

    const { result } = renderHook(() => useQuantityEditModal({ items }));

    act(() => {
      result.current.openForItem('non-existent');
    });

    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
  });

  it('transforms item to QuantityEditItem format', () => {
    const items = [createItem()];

    const { result } = renderHook(() => useQuantityEditModal({ items }));

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

    const { result } = renderHook(() => useQuantityEditModal({ items }));

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

    const { result } = renderHook(() => useQuantityEditModal({ items }));

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem!.itemUnits).toEqual([]);
  });

  it('closes the modal', () => {
    const items = [createItem()];

    const { result } = renderHook(() => useQuantityEditModal({ items }));

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
    mockUpdateQuantity.mockResolvedValue({
      data: {
        updateShoppingListItemQuantity: {
          shoppingListItem: { id: 'item-1' },
        },
      },
    });

    const items = [createItem()];

    const { result } = renderHook(() => useQuantityEditModal({ items }));

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('5', 'gal', 'unit-1');
    });

    expect(mockUpdateQuantity).toHaveBeenCalledWith({
      variables: {
        itemId: 'item-1',
        quantity: '5',
        unitId: 'unit-1',
        version: 3,
      },
    });
  });

  it('closes modal after successful save', async () => {
    mockUpdateQuantity.mockResolvedValue({
      data: {
        updateShoppingListItemQuantity: {
          shoppingListItem: { id: 'item-1' },
        },
      },
    });

    const items = [createItem()];

    const { result } = renderHook(() => useQuantityEditModal({ items }));

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
    const items = [createItem()];

    const { result } = renderHook(() => useQuantityEditModal({ items }));

    await act(async () => {
      await result.current.save('5', null, null);
    });

    expect(mockUpdateQuantity).not.toHaveBeenCalled();
  });

  it('defaults quantity to 0 when item.quantity is null', () => {
    const items = [createItem({ quantity: null })];

    const { result } = renderHook(() => useQuantityEditModal({ items }));

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem!.quantity).toBe(0);
  });

  it('defaults itemName to "Item" when missing', () => {
    const items = [createItem({ itemName: '' })];

    const { result } = renderHook(() => useQuantityEditModal({ items }));

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem!.itemName).toBe('Item');
  });

  it('uses unitName when unit.symbol is not available', () => {
    const items = [createItem({ unit: null, unitName: 'kilogram' })];

    const { result } = renderHook(() => useQuantityEditModal({ items }));

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem!.unitName).toBe('kilogram');
  });
});
