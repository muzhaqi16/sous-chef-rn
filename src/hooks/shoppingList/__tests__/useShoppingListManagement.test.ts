import { renderHook } from '@testing-library/react-native';
import { useShoppingListManagement } from '../useShoppingListManagement';

// --- Mocks ---

const mockAddItem = jest.fn();
const mockUpdateItem = jest.fn();
const mockRemoveItem = jest.fn();
const mockToggleItem = jest.fn();
const mockRefetch = jest.fn().mockResolvedValue(undefined);

const mockShoppingList = {
  id: 'list-1',
  name: 'Groceries',
  isDefault: true,
};

function createItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    itemName: 'Milk',
    quantity: 1,
    category: 'Dairy',
    purchaseInfo: { isPurchased: false },
    sortOrder: 'aaa',
    ...overrides,
  } as any;
}

const mockUnpurchasedItems = [
  createItem({ id: 'item-1', itemName: 'Milk', category: 'Dairy' }),
  createItem({ id: 'item-2', itemName: 'Bread', category: 'Bakery' }),
];

const mockPurchasedItems = [
  createItem({
    id: 'item-3',
    itemName: 'Eggs',
    category: 'Dairy',
    purchaseInfo: { isPurchased: true },
  }),
];

jest.mock('../useShoppingListItemsQuery', () => ({
  useShoppingListItemsQuery: () => ({
    shoppingList: mockShoppingList,
    error: null,
  }),
}));

jest.mock('../usePaginatedShoppingItems', () => ({
  usePaginatedShoppingItems: () => ({
    unpurchased: {
      items: mockUnpurchasedItems,
      totalCount: 2,
      hasMore: false,
      isLoadingMore: false,
      loadMore: jest.fn(),
    },
    purchased: {
      items: mockPurchasedItems,
      totalCount: 1,
      hasMore: false,
      isLoadingMore: false,
      loadMore: jest.fn(),
    },
    loading: false,
    error: undefined,
    refetch: mockRefetch,
    isTransitioning: false,
  }),
}));

jest.mock('../mutations/useShoppingListItemMutations', () => ({
  useShoppingListItemMutations: () => ({
    addItem: mockAddItem,
    updateItem: mockUpdateItem,
    removeItem: mockRemoveItem,
    toggleItem: mockToggleItem,
  }),
}));

jest.mock('../../useSearchableList', () => ({
  useSearchableList: (items: any[]) => ({
    query: '',
    setQuery: jest.fn(),
    filtered: items,
  }),
}));

jest.mock('#/utils/searchUtils', () => ({
  shoppingListItemSearch: jest.fn((item: any, query: string) =>
    item.itemName.toLowerCase().includes(query.toLowerCase()),
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useShoppingListManagement', () => {
  it('returns all expected properties', () => {
    const { result } = renderHook(() =>
      useShoppingListManagement('list-1'),
    );

    // Data
    expect(result.current.items).toBeDefined();
    expect(result.current.allItems).toBeDefined();
    expect(result.current.unpurchasedItems).toBeDefined();
    expect(result.current.purchasedItems).toBeDefined();
    expect(result.current.shoppingList).toBe(mockShoppingList);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeFalsy();
    expect(result.current.isTransitioning).toBe(false);

    // Counts
    expect(result.current.totalCountUnpurchased).toBe(2);
    expect(result.current.totalCountPurchased).toBe(1);

    // Actions
    expect(result.current.addItem).toBe(mockAddItem);
    expect(result.current.updateItem).toBe(mockUpdateItem);
    expect(result.current.removeItem).toBe(mockRemoveItem);
    expect(result.current.toggleItem).toBe(mockToggleItem);
    expect(result.current.refetch).toBe(mockRefetch);

    // Search
    expect(typeof result.current.searchQuery).toBe('string');
    expect(typeof result.current.setSearchQuery).toBe('function');

    // Pagination
    expect(typeof result.current.loadMoreUnpurchased).toBe('function');
    expect(typeof result.current.loadMorePurchased).toBe('function');
    expect(result.current.hasMoreUnpurchased).toBe(false);
    expect(result.current.hasMorePurchased).toBe(false);
  });

  it('combines unpurchased and purchased items into allItems', () => {
    const { result } = renderHook(() =>
      useShoppingListManagement('list-1'),
    );

    expect(result.current.allItems).toHaveLength(3);
    expect(result.current.allItems.map((i: any) => i.id)).toEqual([
      'item-1',
      'item-2',
      'item-3',
    ]);
  });

  it('returns unpurchasedItems and purchasedItems separately', () => {
    const { result } = renderHook(() =>
      useShoppingListManagement('list-1'),
    );

    expect(result.current.unpurchasedItems).toHaveLength(2);
    expect(result.current.purchasedItems).toHaveLength(1);
  });

  describe('helper functions', () => {
    it('getItemById finds item by id', () => {
      const { result } = renderHook(() =>
        useShoppingListManagement('list-1'),
      );

      const found = result.current.getItemById('item-2');
      expect(found?.itemName).toBe('Bread');
    });

    it('getItemById returns undefined for non-existent id', () => {
      const { result } = renderHook(() =>
        useShoppingListManagement('list-1'),
      );

      const found = result.current.getItemById('non-existent');
      expect(found).toBeUndefined();
    });

    it('getCompletedItems returns purchased items', () => {
      const { result } = renderHook(() =>
        useShoppingListManagement('list-1'),
      );

      const completed = result.current.getCompletedItems();
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe('item-3');
    });

    it('getPendingItems returns unpurchased items', () => {
      const { result } = renderHook(() =>
        useShoppingListManagement('list-1'),
      );

      const pending = result.current.getPendingItems();
      expect(pending).toHaveLength(2);
    });

    it('getItemsByCategory filters by category', () => {
      const { result } = renderHook(() =>
        useShoppingListManagement('list-1'),
      );

      const dairyItems = result.current.getItemsByCategory('Dairy');
      expect(dairyItems).toHaveLength(2); // Milk and Eggs
    });

    it('getItemsByCategory returns empty for non-existent category', () => {
      const { result } = renderHook(() =>
        useShoppingListManagement('list-1'),
      );

      const items = result.current.getItemsByCategory('Produce');
      expect(items).toHaveLength(0);
    });
  });
});
