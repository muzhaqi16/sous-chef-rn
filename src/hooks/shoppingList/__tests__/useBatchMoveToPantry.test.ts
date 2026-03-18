import { renderHook, act } from '@testing-library/react-native';
import { useBatchMoveToPantry } from '../useBatchMoveToPantry';

// --- Mocks ---

const mockMovePurchasedMutation = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastInfo = jest.fn();
let capturedMutationOptions: any;

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useMovePurchasedItemsToPantryMutation: (options: any) => {
    capturedMutationOptions = options;
    return [mockMovePurchasedMutation, { loading: false }];
  },
}));

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
    info: (...args: any[]) => mockToastInfo(...args),
  },
}));

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackEvent: jest.fn(),
  },
}));

jest.mock('#/utils/compilerSafeWrappers');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useBatchMoveToPantry', () => {
  it('returns batchMoveToPantry function and loading state', () => {
    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
    );

    expect(typeof result.current.batchMoveToPantry).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('shows error toast when no list is selected', async () => {
    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: undefined }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastError).toHaveBeenCalledWith('No shopping list selected');
    expect(mockMovePurchasedMutation).not.toHaveBeenCalled();
  });

  it('calls mutation with correct variables', async () => {
    mockMovePurchasedMutation.mockResolvedValue({
      data: {
        movePurchasedItemsToPantry: {
          movedCount: 3,
          skippedCount: 0,
          targetPantryName: 'My Pantry',
          movedItems: [
            { shoppingListItemId: 'item-1' },
            { shoppingListItemId: 'item-2' },
            { shoppingListItemId: 'item-3' },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockMovePurchasedMutation).toHaveBeenCalledWith({
      variables: { shoppingListId: 'list-1' },
    });
  });

  it('shows success toast with moved count', async () => {
    mockMovePurchasedMutation.mockResolvedValue({
      data: {
        movePurchasedItemsToPantry: {
          movedCount: 3,
          skippedCount: 0,
          targetPantryName: 'My Pantry',
          movedItems: [
            { shoppingListItemId: 'item-1' },
            { shoppingListItemId: 'item-2' },
            { shoppingListItemId: 'item-3' },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Moved 3 items to My Pantry');
  });

  it('shows success toast with singular item text', async () => {
    mockMovePurchasedMutation.mockResolvedValue({
      data: {
        movePurchasedItemsToPantry: {
          movedCount: 1,
          skippedCount: 0,
          targetPantryName: 'My Pantry',
          movedItems: [{ shoppingListItemId: 'item-1' }],
        },
      },
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Moved 1 item to My Pantry');
  });

  it('includes skipped count in toast when items were skipped', async () => {
    mockMovePurchasedMutation.mockResolvedValue({
      data: {
        movePurchasedItemsToPantry: {
          movedCount: 2,
          skippedCount: 1,
          targetPantryName: 'My Pantry',
          movedItems: [
            { shoppingListItemId: 'item-1' },
            { shoppingListItemId: 'item-2' },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Moved 2 items to My Pantry (1 skipped)',
    );
  });

  it('shows info toast when no items could be moved', async () => {
    mockMovePurchasedMutation.mockResolvedValue({
      data: {
        movePurchasedItemsToPantry: {
          movedCount: 0,
          skippedCount: 3,
          targetPantryName: 'My Pantry',
          movedItems: [],
        },
      },
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastInfo).toHaveBeenCalledWith(
      'No items could be moved to pantry',
    );
  });

  it('calls onSuccess callback after successful move', async () => {
    const mockOnSuccess = jest.fn();

    mockMovePurchasedMutation.mockResolvedValue({
      data: {
        movePurchasedItemsToPantry: {
          movedCount: 1,
          skippedCount: 0,
          targetPantryName: 'My Pantry',
          movedItems: [{ shoppingListItemId: 'item-1' }],
        },
      },
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({
        currentListId: 'list-1',
        onSuccess: mockOnSuccess,
      }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it('tracks telemetry event', async () => {
    const { Telemetry } = require('#/services/telemetry');

    mockMovePurchasedMutation.mockResolvedValue({
      data: {
        movePurchasedItemsToPantry: {
          movedCount: 2,
          skippedCount: 1,
          targetPantryName: 'My Pantry',
          movedItems: [
            { shoppingListItemId: 'item-1' },
            { shoppingListItemId: 'item-2' },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'batch_move_purchased_to_pantry',
      expect.objectContaining({
        shopping_list_id: 'list-1',
        moved_count: 2,
        skipped_count: 1,
      }),
    );
  });

  it('does not call onSuccess when mutation returns no data', async () => {
    const mockOnSuccess = jest.fn();

    mockMovePurchasedMutation.mockResolvedValue({
      data: null,
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({
        currentListId: 'list-1',
        onSuccess: mockOnSuccess,
      }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Cache update logic
  // ---------------------------------------------------------------------------

  describe('cache update logic', () => {
    function createMockCache() {
      return {
        modify: jest.fn(),
        evict: jest.fn(),
        gc: jest.fn(),
        identify: jest.fn(
          (obj: { __typename: string; id: string }) =>
            `${obj.__typename}:${obj.id}`,
        ),
      } as any;
    }

    function invokeFieldModifier(
      mockCache: any,
      fieldName: string,
      existingValue: any,
      helpers: any,
    ) {
      const modifyCall = mockCache.modify.mock.calls[0];
      const fields = modifyCall[0].fields;
      if (!fields[fieldName]) return undefined;
      return fields[fieldName](existingValue, helpers);
    }

    function createFieldHelpers(storeFieldName: string) {
      return {
        readField: jest.fn((field: string, ref: any) => {
          if (!ref) return undefined;
          if (ref.__ref) {
            const parts = ref.__ref.split(':');
            if (field === 'id') return parts[1];
          }
          return ref[field];
        }),
        storeFieldName,
      };
    }

    it('renders hook to capture mutation options', () => {
      renderHook(() => useBatchMoveToPantry({ currentListId: 'list-1' }));
      expect(capturedMutationOptions.update).toBeDefined();
    });

    it('removes items from purchased variant only and updates counters', () => {
      renderHook(() => useBatchMoveToPantry({ currentListId: 'list-1' }));
      const cache = createMockCache();

      const data = {
        movePurchasedItemsToPantry: {
          movedItems: [
            { shoppingListItemId: 'item-1' },
            { shoppingListItemId: 'item-2' },
          ],
        },
      };

      capturedMutationOptions.update(cache, { data });

      expect(cache.modify).toHaveBeenCalledTimes(1);

      // Purchased variant: should filter edges
      const purchasedHelpers = createFieldHelpers(
        'itemsConnection:{"isPurchased":true}',
      );
      const purchasedExisting = {
        edges: [
          { node: { __ref: 'ShoppingListItem:item-1' } },
          { node: { __ref: 'ShoppingListItem:item-2' } },
          { node: { __ref: 'ShoppingListItem:item-3' } },
        ],
        totalCount: 3,
      };
      const purchasedResult = invokeFieldModifier(
        cache,
        'itemsConnection',
        purchasedExisting,
        purchasedHelpers,
      );
      expect(purchasedResult.edges).toHaveLength(1);
      expect(purchasedResult.totalCount).toBe(1);

      // Unpurchased variant: should return existing unchanged
      const unpurchasedHelpers = createFieldHelpers(
        'itemsConnection:{"isPurchased":false}',
      );
      const unpurchasedExisting = {
        edges: [{ node: { __ref: 'ShoppingListItem:item-4' } }],
        totalCount: 5,
      };
      const unpurchasedResult = invokeFieldModifier(
        cache,
        'itemsConnection',
        unpurchasedExisting,
        unpurchasedHelpers,
      );
      expect(unpurchasedResult).toBe(unpurchasedExisting);

      // Counter fields
      const totalItemsResult = invokeFieldModifier(cache, 'totalItems', 10, {});
      expect(totalItemsResult).toBe(8);
      const completedResult = invokeFieldModifier(
        cache,
        'completedItems',
        5,
        {},
      );
      expect(completedResult).toBe(3);
    });

    it('evicts moved items and runs gc', () => {
      renderHook(() => useBatchMoveToPantry({ currentListId: 'list-1' }));
      const cache = createMockCache();

      const data = {
        movePurchasedItemsToPantry: {
          movedItems: [
            { shoppingListItemId: 'item-1' },
            { shoppingListItemId: 'item-2' },
          ],
        },
      };

      capturedMutationOptions.update(cache, { data });

      expect(cache.evict).toHaveBeenCalledTimes(2);
      expect(cache.evict).toHaveBeenCalledWith({
        id: 'ShoppingListItem:item-1',
      });
      expect(cache.evict).toHaveBeenCalledWith({
        id: 'ShoppingListItem:item-2',
      });
      expect(cache.gc).toHaveBeenCalledTimes(1);
    });

    it('does nothing when movedItems is empty', () => {
      renderHook(() => useBatchMoveToPantry({ currentListId: 'list-1' }));
      const cache = createMockCache();

      const data = {
        movePurchasedItemsToPantry: { movedItems: [] },
      };

      capturedMutationOptions.update(cache, { data });

      expect(cache.modify).not.toHaveBeenCalled();
      expect(cache.evict).not.toHaveBeenCalled();
    });

    it('does nothing when data is null', () => {
      renderHook(() => useBatchMoveToPantry({ currentListId: 'list-1' }));
      const cache = createMockCache();

      capturedMutationOptions.update(cache, { data: null });

      expect(cache.modify).not.toHaveBeenCalled();
    });

    it('does nothing when parent entity is not found', () => {
      renderHook(() => useBatchMoveToPantry({ currentListId: 'list-1' }));
      const cache = createMockCache();
      cache.identify.mockReturnValue(undefined);

      const data = {
        movePurchasedItemsToPantry: {
          movedItems: [{ shoppingListItemId: 'item-1' }],
        },
      };

      capturedMutationOptions.update(cache, { data });

      expect(cache.modify).not.toHaveBeenCalled();
    });
  });
});
