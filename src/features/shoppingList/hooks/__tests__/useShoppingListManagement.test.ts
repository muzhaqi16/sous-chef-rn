import { renderHook } from '@testing-library/react-native';
import { useShoppingListManagement } from '../useShoppingListManagement';

// --- Mocks ---

const mockAddItem = jest.fn();
const mockUpdateItem = jest.fn();
const mockRemoveItem = jest.fn();
const mockToggleItem = jest.fn();
const mockRefetch = jest.fn().mockResolvedValue(undefined);

interface MockShoppingItem {
  id: string;
  itemName: string;
  quantity: number;
  category: string;
  purchaseInfo: { isPurchased: boolean };
  sortOrder: string;
}

interface MockShoppingList {
  id: string;
  name: string;
  isDefault: boolean;
  completedItems?: number;
}

const mockShoppingList: MockShoppingList = {
  id: 'list-1',
  name: 'Groceries',
  isDefault: true,
};

function createItem(
  overrides: Partial<MockShoppingItem> = {},
): MockShoppingItem {
  return {
    id: 'item-1',
    itemName: 'Milk',
    quantity: 1,
    category: 'Dairy',
    purchaseInfo: { isPurchased: false },
    sortOrder: 'aaa',
    ...overrides,
  };
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

let mockShoppingListResult: MockShoppingList = mockShoppingList;

jest.mock('../useShoppingListItemsQuery', () => ({
  useShoppingListItemsQuery: () => ({
    shoppingList: mockShoppingListResult,
    error: null,
  }),
}));

let mockPurchasedTotalCount: number | undefined = 1;

jest.mock('../usePaginatedShoppingItems', () => ({
  usePaginatedShoppingItems: () => ({
    state: {
      unpurchased: {
        items: mockUnpurchasedItems,
        totalCount: 2,
        hasMore: false,
        isLoadingMore: false,
        loadMore: jest.fn(),
      },
      purchased: {
        items: mockPurchasedItems,
        totalCount: mockPurchasedTotalCount,
        hasMore: false,
        isLoadingMore: false,
        loadMore: jest.fn(),
      },
      loading: false,
      error: undefined,
      isTransitioning: false,
    },
    actions: {
      refetch: mockRefetch,
    },
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

jest.mock('#hooks/useSearchableList', () => ({
  useSearchableList: <T>(items: T[]) => ({
    query: '',
    setQuery: jest.fn(),
    filtered: items,
  }),
}));

jest.mock('#/utils/searchUtils', () => ({
  shoppingListItemSearch: jest.fn((item: { itemName: string }, query: string) =>
    item.itemName.toLowerCase().includes(query.toLowerCase()),
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPurchasedTotalCount = 1;
  mockShoppingListResult = mockShoppingList;
});

describe('useShoppingListManagement', () => {
  it('returns all expected properties', () => {
    const { result } = renderHook(() => useShoppingListManagement('list-1'));

    // Data
    expect(result.current.unpurchasedItems).toBeDefined();
    expect(result.current.purchasedItems).toBeDefined();
    expect(result.current.rawUnpurchasedItems).toBeDefined();
    expect(result.current.rawPurchasedItems).toBeDefined();
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

  it('returns unpurchasedItems and purchasedItems separately', () => {
    const { result } = renderHook(() => useShoppingListManagement('list-1'));

    expect(result.current.unpurchasedItems).toHaveLength(2);
    expect(result.current.purchasedItems).toHaveLength(1);
  });

  it('returns raw (unfiltered) arrays', () => {
    const { result } = renderHook(() => useShoppingListManagement('list-1'));

    expect(result.current.rawUnpurchasedItems).toHaveLength(2);
    expect(result.current.rawPurchasedItems).toHaveLength(1);
  });

  it('uses 0 for totalCountPurchased when purchased.totalCount is 0 (not stale completedItems)', () => {
    mockPurchasedTotalCount = 0;
    mockShoppingListResult = { ...mockShoppingList, completedItems: 5 };

    const { result } = renderHook(() => useShoppingListManagement('list-1'));

    expect(result.current.totalCountPurchased).toBe(0);
  });

  it('falls back to completedItems when purchased.totalCount is undefined', () => {
    mockPurchasedTotalCount = undefined;
    mockShoppingListResult = { ...mockShoppingList, completedItems: 5 };

    const { result } = renderHook(() => useShoppingListManagement('list-1'));

    expect(result.current.totalCountPurchased).toBe(5);
  });
});
