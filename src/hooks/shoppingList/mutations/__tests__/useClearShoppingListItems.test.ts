import { renderHook, act } from '@testing-library/react-native';
import { useClearShoppingListItems } from '../useClearShoppingListItems';

// --- Mocks ---

const mockClearMutation = jest.fn();

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useClearShoppingListItemsMutation: () => [mockClearMutation],
}));

jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({
    cache: {
      identify: jest.fn((obj: any) => `${obj.__typename}:${obj.id}`),
      modify: jest.fn(),
      evict: jest.fn(),
      gc: jest.fn(),
    },
  }),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  clearAllPurchasedItemsFromCache: jest.fn(),
  clearAllUnpurchasedItemsFromCache: jest.fn(),
}));

const {
  clearAllPurchasedItemsFromCache: mockClearAllPurchased,
  clearAllUnpurchasedItemsFromCache: mockClearAllUnpurchased,
} = require('#/apollo/utils/shoppingListCacheUpdaters');

beforeEach(() => {
  jest.clearAllMocks();
});

function createItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    itemName: 'Milk',
    purchaseInfo: { isPurchased: false },
    ...overrides,
  } as any;
}

describe('useClearShoppingListItems', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('returns clearItems function', () => {
    const { result } = renderHook(() =>
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
    const { result } = renderHook(() =>
      useClearShoppingListItems({
        listId: null,
        unpurchasedItems: [],
        purchasedItems: [createItem({ purchaseInfo: { isPurchased: true } })],
        refetch: mockRefetch,
      }),
    );

    await act(async () => {
      await result.current.clearItems(true);
    });

    expect(mockClearMutation).not.toHaveBeenCalled();
    expect(mockClearAllPurchased).not.toHaveBeenCalled();
  });

  it('does nothing when no target items exist (purchased=true but none purchased)', async () => {
    const { result } = renderHook(() =>
      useClearShoppingListItems({
        listId: 'list-1',
        unpurchasedItems: [createItem({ purchaseInfo: { isPurchased: false } })],
        purchasedItems: [],
        refetch: mockRefetch,
      }),
    );

    await act(async () => {
      await result.current.clearItems(true);
    });

    expect(mockClearMutation).not.toHaveBeenCalled();
    expect(mockClearAllPurchased).not.toHaveBeenCalled();
  });

  it('clears purchased items from cache and fires mutation', async () => {
    mockClearMutation.mockResolvedValue({
      data: { clearShoppingListItems: true },
    });

    const { result } = renderHook(() =>
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
    );

    await act(async () => {
      await result.current.clearItems(true);
    });

    // Should clear purchased items from cache optimistically
    expect(mockClearAllPurchased).toHaveBeenCalledWith(
      expect.anything(), // cache
      'list-1',
      ['item-1', 'item-3'],
    );

    // Should fire mutation
    expect(mockClearMutation).toHaveBeenCalledWith({
      variables: { shoppingListId: 'list-1', purchased: true },
      update: expect.any(Function),
    });
  });

  it('clears unpurchased items from cache and fires mutation', async () => {
    mockClearMutation.mockResolvedValue({
      data: { clearShoppingListItems: true },
    });

    const { result } = renderHook(() =>
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
    );

    await act(async () => {
      await result.current.clearItems(false);
    });

    // Should clear unpurchased items from cache
    expect(mockClearAllUnpurchased).toHaveBeenCalledWith(
      expect.anything(),
      'list-1',
      ['item-1', 'item-3'],
    );

    // Should fire mutation with purchased=false
    expect(mockClearMutation).toHaveBeenCalledWith({
      variables: { shoppingListId: 'list-1', purchased: false },
      update: expect.any(Function),
    });
  });

  it('prevents concurrent calls via isClearingRef guard', async () => {
    // First mutation never resolves (simulating slow mutation)
    let resolveFirst: ((value: any) => void) | undefined;
    mockClearMutation.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveFirst = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useClearShoppingListItems({
        listId: 'list-1',
        unpurchasedItems: [],
        purchasedItems: [
          createItem({ id: 'item-1', purchaseInfo: { isPurchased: true } }),
        ],
        refetch: mockRefetch,
      }),
    );

    // Start first call (will hang)
    const firstCall = act(async () => {
      await result.current.clearItems(true);
    });

    // Second call should be a no-op since first is in progress
    await act(async () => {
      await result.current.clearItems(true);
    });

    // Only one mutation call should have been made
    expect(mockClearMutation).toHaveBeenCalledTimes(1);

    // Resolve first call to clean up
    resolveFirst?.({ data: { clearShoppingListItems: true } });
    await firstCall;
  });
});
