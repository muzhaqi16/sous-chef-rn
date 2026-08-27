/**
 * `isLoadingInitial` says a request is still in flight — nothing else.
 *
 * Not `!hasUIItems && (loading || hasRawData)`: those two counts are different
 * sets — `hasUIItems` counts the rows the list would render (post-search),
 * `hasRawData` every row fetched. A search matching none of the loaded items
 * satisfies `hasRawData`, showing loading skeletons for a result that has
 * already arrived instead of the "nothing matched" state.
 *
 * The composed hooks are mocked rather than driven through Apollo: the
 * derivation under test reads four numbers, and standing up the real query,
 * selection and transform layers to produce them would test those instead.
 * Apollo itself is real (`renderHookWithApollo`) — the hook takes a client only
 * to evict lists it was denied, which this never exercises.
 */
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useShoppingListScreen } from '../useShoppingListScreen';

jest.mock('#store/useAppStore', () => ({
  useUser: () => ({ id: 'user-1' }),
}));

jest.mock('#components/atoms/CachedImage', () => ({
  preloadImages: jest.fn(),
}));

jest.mock('#hooks/settings/useUserPreferences', () => ({
  useShowShoppingListImages: () => false,
}));

jest.mock('../useShoppingListsQuery', () => ({
  useShoppingListsQuery: () => ({
    lists: [{ id: 'list-1', name: 'Groceries' }],
    loading: false,
    error: undefined,
    hasResult: true,
  }),
}));

jest.mock('../useShoppingListSelection', () => ({
  useShoppingListSelection: () => ({
    selectedListId: 'list-1',
    currentListId: 'list-1',
    optimisticListId: 'list-1',
    setSelectedShoppingListId: jest.fn(),
  }),
}));

// Wraps nodes for FlashList; identity-preserving enough for this derivation.
jest.mock('../useShoppingListTransform', () => ({
  useShoppingListTransformMulti: ({
    rawUnpurchasedItems,
    rawPurchasedItems,
  }: {
    rawUnpurchasedItems: unknown[];
    rawPurchasedItems: unknown[];
  }) => ({
    unpurchasedItems: rawUnpurchasedItems,
    purchasedItems: rawPurchasedItems,
  }),
}));

const managementState = {
  // What the query fetched, before the search filter.
  rawUnpurchasedItems: [] as unknown[],
  rawPurchasedItems: [] as unknown[],
  // What survives the search filter — the rows the list would render.
  unpurchasedItems: [] as unknown[],
  purchasedItems: [] as unknown[],
  itemsLoading: false,
};

jest.mock('../useShoppingListManagement', () => ({
  useShoppingListManagement: () => ({
    ...managementState,
    shoppingList: { id: 'list-1' },
    loading: managementState.itemsLoading,
    itemsLoading: managementState.itemsLoading,
    listsLoading: false,
    error: undefined,
    refetch: jest.fn(),
    searchQuery: '',
    setSearchQuery: jest.fn(),
    addItem: jest.fn(),
    removeItem: jest.fn(),
    toggleItem: jest.fn(),
    recordPurchase: jest.fn(),
    totalCountUnpurchased: managementState.rawUnpurchasedItems.length,
    totalCountPurchased: managementState.rawPurchasedItems.length,
    loadMoreUnpurchased: jest.fn(),
    hasMoreUnpurchased: false,
    isLoadingMoreUnpurchased: false,
    loadMorePurchased: jest.fn(),
    hasMorePurchased: false,
    isLoadingMorePurchased: false,
  }),
}));

const setItems = (raw: number, filtered: number, itemsLoading = false) => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `i${i}`,
      itemName: `Item ${i}`,
    }));
  managementState.rawUnpurchasedItems = rows(raw);
  managementState.rawPurchasedItems = [];
  managementState.unpurchasedItems = rows(filtered);
  managementState.purchasedItems = [];
  managementState.itemsLoading = itemsLoading;
};

describe('useShoppingListScreen isLoadingInitial', () => {
  it('is false when a search excludes every loaded row', () => {
    // Twelve rows fetched, none matching the search. Settled, not loading.
    setItems(12, 0);

    const { result } = renderHookWithApollo(() => useShoppingListScreen());

    expect(result.current.state.isLoadingInitial).toBe(false);
  });

  it('is true while the first fetch is still in flight', () => {
    setItems(0, 0, true);

    const { result } = renderHookWithApollo(() => useShoppingListScreen());

    expect(result.current.state.isLoadingInitial).toBe(true);
  });

  it('is false once rows are on screen', () => {
    setItems(12, 12);

    const { result } = renderHookWithApollo(() => useShoppingListScreen());

    expect(result.current.state.isLoadingInitial).toBe(false);
  });

  it('is false for a list that genuinely holds nothing', () => {
    setItems(0, 0);

    const { result } = renderHookWithApollo(() => useShoppingListScreen());

    expect(result.current.state.isLoadingInitial).toBe(false);
  });
});
