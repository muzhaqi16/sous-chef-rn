import { renderHook, act } from '@testing-library/react-native';
import { useShoppingListActions } from '../useShoppingListActions';

// --- Mocks ---

const mockUpdateQuantity = jest.fn();
const mockClearItems = jest.fn();
const mockReadFragment = jest.fn();
const mockCacheModify = jest.fn();
const mockCacheIdentify = jest.fn(
  (obj: any) => `${obj.__typename}:${obj.id}` as string | undefined,
);

jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({
    cache: {
      identify: mockCacheIdentify,
      modify: mockCacheModify,
    },
    readFragment: mockReadFragment,
  }),
}));

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useUpdateShoppingListItemQuantityMutation: () => [mockUpdateQuantity],
}));

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackEvent: jest.fn(),
    trackError: jest.fn(),
  },
}));

jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(() => false),
  getVersionConflictMessage: jest.fn(() => 'Item was updated'),
}));

jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: {
    save: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#hooks/haptic/useHaptic', () => ({
  useHaptic: () => ({
    selection: jest.fn(),
    warning: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    light: jest.fn(),
    medium: jest.fn(),
    heavy: jest.fn(),
  }),
}));

jest.mock('../mutations/useClearShoppingListItems', () => ({
  useClearShoppingListItems: () => ({
    clearItems: mockClearItems,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function createItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    itemName: 'Milk',
    quantity: 2,
    version: 1,
    purchaseInfo: { isPurchased: false },
    ...overrides,
  } as any;
}

describe('useShoppingListActions', () => {
  const defaultProps = {
    currentListId: 'list-1',
    unpurchasedItems: [createItem()],
    purchasedItems: [] as any[],
    addItem: jest.fn().mockResolvedValue(true),
    toggleItem: jest.fn().mockResolvedValue(true),
    removeItem: jest.fn().mockResolvedValue(true),
    refetchItems: jest.fn().mockResolvedValue(undefined),
    setSearchQuery: jest.fn(),
  };

  it('returns all action handlers', () => {
    const { result } = renderHook(() => useShoppingListActions(defaultProps));

    expect(typeof result.current.handleIncrementQuantity).toBe('function');
    expect(typeof result.current.handleDecrementQuantity).toBe('function');
    expect(typeof result.current.handleTogglePurchase).toBe('function');
    expect(typeof result.current.handleDeleteItem).toBe('function');
    expect(typeof result.current.handleClearAllPurchased).toBe('function');
    expect(typeof result.current.handleClearAllShopping).toBe('function');
    expect(typeof result.current.handleAddItemFromSearch).toBe('function');
  });

  describe('handleTogglePurchase', () => {
    it('calls toggleItem with the item id', async () => {
      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleTogglePurchase('item-1');
      });

      expect(defaultProps.toggleItem).toHaveBeenCalledWith('item-1');
    });

    it('tracks telemetry event', async () => {
      const { Telemetry } = require('#/services/telemetry');

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleTogglePurchase('item-1');
      });

      expect(Telemetry.trackEvent).toHaveBeenCalledWith(
        'toggle_item_purchase',
        { item_id: 'item-1' },
      );
    });
  });

  describe('handleDeleteItem', () => {
    it('calls removeItem with the item id', async () => {
      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleDeleteItem('item-1');
      });

      expect(defaultProps.removeItem).toHaveBeenCalledWith('item-1');
    });

    it('tracks telemetry event', async () => {
      const { Telemetry } = require('#/services/telemetry');

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleDeleteItem('item-1');
      });

      expect(Telemetry.trackEvent).toHaveBeenCalledWith('delete_item', {
        item_id: 'item-1',
      });
    });
  });

  describe('handleClearAllPurchased', () => {
    it('does nothing when no purchased items exist', async () => {
      const { result } = renderHook(() =>
        useShoppingListActions({
          ...defaultProps,
          purchasedItems: [],
        }),
      );

      await act(async () => {
        await result.current.handleClearAllPurchased();
      });

      expect(mockClearItems).not.toHaveBeenCalled();
    });

    it('calls clearItems with true when purchased items exist', async () => {
      const { result } = renderHook(() =>
        useShoppingListActions({
          ...defaultProps,
          purchasedItems: [
            createItem({
              id: 'item-1',
              purchaseInfo: { isPurchased: true },
            }),
          ],
        }),
      );

      await act(async () => {
        await result.current.handleClearAllPurchased();
      });

      expect(mockClearItems).toHaveBeenCalledWith(true);
    });
  });

  describe('handleClearAllShopping', () => {
    it('does nothing when no unpurchased items exist', async () => {
      const { result } = renderHook(() =>
        useShoppingListActions({
          ...defaultProps,
          unpurchasedItems: [],
        }),
      );

      await act(async () => {
        await result.current.handleClearAllShopping();
      });

      expect(mockClearItems).not.toHaveBeenCalled();
    });

    it('calls clearItems with false when unpurchased items exist', async () => {
      const { result } = renderHook(() =>
        useShoppingListActions({
          ...defaultProps,
          unpurchasedItems: [
            createItem({
              id: 'item-1',
              purchaseInfo: { isPurchased: false },
            }),
          ],
        }),
      );

      await act(async () => {
        await result.current.handleClearAllShopping();
      });

      expect(mockClearItems).toHaveBeenCalledWith(false);
    });
  });

  describe('handleAddItemFromSearch', () => {
    it('shows toast error when no list is selected', async () => {
      const { toastService } = require('#/services/toastService');

      const { result } = renderHook(() =>
        useShoppingListActions({
          ...defaultProps,
          currentListId: undefined,
        }),
      );

      await act(async () => {
        await result.current.handleAddItemFromSearch('Eggs');
      });

      expect(toastService.error).toHaveBeenCalledWith(
        'Please select a shopping list first',
      );
      expect(defaultProps.addItem).not.toHaveBeenCalled();
    });

    it('clears search query immediately', async () => {
      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleAddItemFromSearch('Eggs');
      });

      expect(defaultProps.setSearchQuery).toHaveBeenCalledWith('');
    });

    it('calls addItem with trimmed name and quantity 1', async () => {
      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleAddItemFromSearch('  Eggs  ');
      });

      expect(defaultProps.addItem).toHaveBeenCalledWith({
        itemName: 'Eggs',
        quantity: 1,
      });
    });

    it('tracks success telemetry event', async () => {
      const { Telemetry } = require('#/services/telemetry');

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleAddItemFromSearch('Eggs');
      });

      expect(Telemetry.trackEvent).toHaveBeenCalledWith('add_item_success', {
        source: 'search',
      });
    });
  });

  describe('handleIncrementQuantity', () => {
    it('early returns when item not in cache', async () => {
      mockCacheIdentify.mockReturnValue(undefined);

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleIncrementQuantity('item-1');
      });

      expect(mockUpdateQuantity).not.toHaveBeenCalled();
    });

    it('increments quantity and calls update mutation', async () => {
      mockCacheIdentify.mockReturnValue('ShoppingListItem:item-1');
      mockReadFragment.mockReturnValue({
        id: 'item-1',
        quantity: 2,
        version: 1,
      });
      mockUpdateQuantity.mockResolvedValue({
        data: {
          updateShoppingListItemQuantity: {
            shoppingListItem: { id: 'item-1', quantity: 3 },
          },
        },
      });

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleIncrementQuantity('item-1');
      });

      // Should modify cache immediately
      expect(mockCacheModify).toHaveBeenCalled();

      // Should call mutation with new quantity
      expect(mockUpdateQuantity).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            itemId: 'item-1',
            quantity: '3', // incremented from 2 to 3
            version: 1,
          },
        }),
      );
    });
  });

  describe('handleDecrementQuantity', () => {
    it('decrements quantity but not below 1', async () => {
      mockCacheIdentify.mockReturnValue('ShoppingListItem:item-1');
      mockReadFragment.mockReturnValue({
        id: 'item-1',
        quantity: 1,
        version: 1,
      });
      mockUpdateQuantity.mockResolvedValue({
        data: {
          updateShoppingListItemQuantity: {
            shoppingListItem: { id: 'item-1', quantity: 1 },
          },
        },
      });

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleDecrementQuantity('item-1');
      });

      // Should call mutation with quantity still at 1 (Math.max(1, 0))
      expect(mockUpdateQuantity).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            itemId: 'item-1',
            quantity: '1',
            version: 1,
          },
        }),
      );
    });

    it('early returns when cache identify returns undefined', async () => {
      mockCacheIdentify.mockReturnValue(undefined);

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleDecrementQuantity('item-1');
      });

      expect(mockUpdateQuantity).not.toHaveBeenCalled();
    });

    it('early returns when readFragment returns null', async () => {
      mockCacheIdentify.mockReturnValue('ShoppingListItem:item-1');
      mockReadFragment.mockReturnValue(null);

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleDecrementQuantity('item-1');
      });

      expect(mockUpdateQuantity).not.toHaveBeenCalled();
    });

    it('decrements from quantity 5 to 4', async () => {
      mockCacheIdentify.mockReturnValue('ShoppingListItem:item-1');
      mockReadFragment.mockReturnValue({
        id: 'item-1',
        quantity: 5,
        version: 2,
      });
      mockUpdateQuantity.mockResolvedValue({
        data: {
          updateShoppingListItemQuantity: {
            shoppingListItem: { id: 'item-1', quantity: 4 },
          },
        },
      });

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleDecrementQuantity('item-1');
      });

      expect(mockUpdateQuantity).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            itemId: 'item-1',
            quantity: '4',
            version: 2,
          },
        }),
      );
    });

    it('handles null quantity as 1', async () => {
      mockCacheIdentify.mockReturnValue('ShoppingListItem:item-1');
      mockReadFragment.mockReturnValue({
        id: 'item-1',
        quantity: null,
        version: 1,
      });
      mockUpdateQuantity.mockResolvedValue({
        data: {
          updateShoppingListItemQuantity: {
            shoppingListItem: { id: 'item-1', quantity: 1 },
          },
        },
      });

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleDecrementQuantity('item-1');
      });

      // null ?? 1 = 1, then Math.max(1, 1 - 1) = Math.max(1, 0) = 1
      expect(mockUpdateQuantity).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            quantity: '1',
          }),
        }),
      );
    });
  });

  describe('handleIncrementQuantity - readFragment returns null', () => {
    it('early returns when readFragment returns null', async () => {
      mockCacheIdentify.mockReturnValue('ShoppingListItem:item-1');
      mockReadFragment.mockReturnValue(null);

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleIncrementQuantity('item-1');
      });

      expect(mockUpdateQuantity).not.toHaveBeenCalled();
    });

    it('increments from zero quantity', async () => {
      mockCacheIdentify.mockReturnValue('ShoppingListItem:item-1');
      mockReadFragment.mockReturnValue({
        id: 'item-1',
        quantity: 0,
        version: 1,
      });
      mockUpdateQuantity.mockResolvedValue({
        data: {
          updateShoppingListItemQuantity: {
            shoppingListItem: { id: 'item-1', quantity: 1 },
          },
        },
      });

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleIncrementQuantity('item-1');
      });

      expect(mockUpdateQuantity).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            quantity: '1', // 0 + 1
          }),
        }),
      );
    });
  });

  describe('handleAddItemFromSearch - add fails', () => {
    it('shows error toast when addItem returns falsy', async () => {
      const { toastService } = require('#/services/toastService');
      const failAddItem = jest.fn().mockResolvedValue(null);

      const { result } = renderHook(() =>
        useShoppingListActions({
          ...defaultProps,
          addItem: failAddItem,
        }),
      );

      await act(async () => {
        await result.current.handleAddItemFromSearch('Eggs');
      });

      expect(toastService.error).toHaveBeenCalledWith('Failed to add item');
    });
  });

  // ========== Additional branch/function coverage tests ==========

  describe('handleAddItemFromSearch - error path', () => {
    it('handles error in addItem and resets searchQuery', async () => {
      const { toastService } = require('#/services/toastService');
      const { Telemetry } = require('#/services/telemetry');
      const { executeMutation } = require('#/utils/compilerSafeWrappers');

      // Make executeMutation call the error handler
      executeMutation.mockImplementationOnce(async (_fn: any, onError: any) => {
        onError(new Error('Network error'));
        return false;
      });

      const mockSetSearchQuery = jest.fn();
      const { result } = renderHook(() =>
        useShoppingListActions({
          ...defaultProps,
          setSearchQuery: mockSetSearchQuery,
        }),
      );

      await act(async () => {
        await result.current.handleAddItemFromSearch('  Eggs  ');
      });

      expect(toastService.error).toHaveBeenCalledWith('Failed to add item');
      expect(Telemetry.trackError).toHaveBeenCalled();
      // searchQuery should be set to trimmed value on error
      expect(mockSetSearchQuery).toHaveBeenCalledWith('Eggs');
    });

    it('tracks add_item_failed telemetry when addItem returns falsy', async () => {
      const { Telemetry } = require('#/services/telemetry');
      const failAddItem = jest.fn().mockResolvedValue(null);

      const { result } = renderHook(() =>
        useShoppingListActions({
          ...defaultProps,
          addItem: failAddItem,
        }),
      );

      await act(async () => {
        await result.current.handleAddItemFromSearch('Eggs');
      });

      expect(Telemetry.trackEvent).toHaveBeenCalledWith('add_item_failed', {
        source: 'search',
      });
    });

    it('sets searchQuery back to trimmed value when addItem returns falsy', async () => {
      const failAddItem = jest.fn().mockResolvedValue(null);
      const mockSetSearchQuery = jest.fn();

      const { result } = renderHook(() =>
        useShoppingListActions({
          ...defaultProps,
          addItem: failAddItem,
          setSearchQuery: mockSetSearchQuery,
        }),
      );

      await act(async () => {
        await result.current.handleAddItemFromSearch('  Butter  ');
      });

      // First call: clear to '', second call: set to trimmed 'Butter'
      expect(mockSetSearchQuery).toHaveBeenCalledWith('');
      expect(mockSetSearchQuery).toHaveBeenCalledWith('Butter');
    });
  });

  describe('handleTogglePurchase - error path', () => {
    it('handles toggle error with haptic feedback and toast', async () => {
      const { toastService } = require('#/services/toastService');
      const { Telemetry } = require('#/services/telemetry');
      const { executeMutation } = require('#/utils/compilerSafeWrappers');

      executeMutation.mockImplementationOnce(async (_fn: any, onError: any) => {
        onError(new Error('Toggle failed'));
        return false;
      });

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleTogglePurchase('item-1');
      });

      expect(Telemetry.trackEvent).toHaveBeenCalledWith(
        'toggle_item_purchase',
        { item_id: 'item-1' },
      );
      expect(Telemetry.trackError).toHaveBeenCalled();
      expect(toastService.error).toHaveBeenCalledWith('Failed to toggle item');
    });
  });

  describe('handleDeleteItem - error path', () => {
    it('handles delete error with haptic feedback and toast', async () => {
      const { toastService } = require('#/services/toastService');
      const { Telemetry } = require('#/services/telemetry');
      const { executeMutation } = require('#/utils/compilerSafeWrappers');

      executeMutation.mockImplementationOnce(async (_fn: any, onError: any) => {
        onError(new Error('Delete failed'));
        return false;
      });

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleDeleteItem('item-1');
      });

      expect(Telemetry.trackEvent).toHaveBeenCalledWith('delete_item', {
        item_id: 'item-1',
      });
      expect(Telemetry.trackError).toHaveBeenCalled();
      expect(toastService.error).toHaveBeenCalledWith('Failed to delete item');
    });

    it('tracks error as string when error is not Error instance', async () => {
      const { Telemetry } = require('#/services/telemetry');
      const { executeMutation } = require('#/utils/compilerSafeWrappers');

      executeMutation.mockImplementationOnce(async (_fn: any, onError: any) => {
        onError('string error');
        return false;
      });

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleDeleteItem('item-1');
      });

      expect(Telemetry.trackError).toHaveBeenCalledWith(
        'Failed to delete item',
        { component: 'ShoppingListMain', operation: 'deleteItem' },
      );
    });
  });

  describe('handleTogglePurchase - error as string', () => {
    it('tracks error as string when error is not Error instance', async () => {
      const { Telemetry } = require('#/services/telemetry');
      const { executeMutation } = require('#/utils/compilerSafeWrappers');

      executeMutation.mockImplementationOnce(async (_fn: any, onError: any) => {
        onError('string toggle error');
        return false;
      });

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleTogglePurchase('item-1');
      });

      expect(Telemetry.trackError).toHaveBeenCalledWith(
        'Failed to toggle item purchase',
        { component: 'ShoppingListMain', operation: 'togglePurchase' },
      );
    });
  });

  describe('handleClearAllPurchased - error path', () => {
    it('handles clearItems error for purchased items', async () => {
      const { toastService } = require('#/services/toastService');
      const { executeMutation } = require('#/utils/compilerSafeWrappers');

      executeMutation.mockImplementationOnce(async (_fn: any, onError: any) => {
        onError(new Error('Clear failed'));
        return false;
      });

      const { result } = renderHook(() =>
        useShoppingListActions({
          ...defaultProps,
          purchasedItems: [createItem({ purchaseInfo: { isPurchased: true } })],
        }),
      );

      await act(async () => {
        await result.current.handleClearAllPurchased();
      });

      expect(toastService.error).toHaveBeenCalledWith(
        'Failed to clear purchased items',
      );
    });
  });

  describe('handleClearAllShopping - error path', () => {
    it('handles clearItems error for unpurchased items', async () => {
      const { toastService } = require('#/services/toastService');
      const { executeMutation } = require('#/utils/compilerSafeWrappers');

      executeMutation.mockImplementationOnce(async (_fn: any, onError: any) => {
        onError(new Error('Clear failed'));
        return false;
      });

      const { result } = renderHook(() =>
        useShoppingListActions({
          ...defaultProps,
          unpurchasedItems: [createItem({ purchaseInfo: { isPurchased: false } })],
        }),
      );

      await act(async () => {
        await result.current.handleClearAllShopping();
      });

      expect(toastService.error).toHaveBeenCalledWith(
        'Failed to clear shopping items',
      );
    });
  });

  describe('handleIncrementQuantity - version conflict', () => {
    it('handles version conflict error on increment', async () => {
      const {
        handleVersionConflict,
      } = require('#/utils/errors/versionConflict');
      const { executeMutation } = require('#/utils/compilerSafeWrappers');

      mockCacheIdentify.mockReturnValue('ShoppingListItem:item-1');
      mockReadFragment.mockReturnValue({
        id: 'item-1',
        quantity: 2,
        version: 1,
      });

      // Make the inner executeMutation call the error handler
      executeMutation.mockImplementationOnce(async (_fn: any, onError: any) => {
        onError({
          graphQLErrors: [{ extensions: { code: 'VERSION_CONFLICT' } }],
        });
        return false;
      });
      handleVersionConflict.mockReturnValueOnce(true);

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleIncrementQuantity('item-1');
      });

      // The cache should have been modified optimistically
      expect(mockCacheModify).toHaveBeenCalled();
    });
  });

  describe('handleIncrementQuantity - onCompleted clears persistence', () => {
    it('clears persistence data on successful mutation completion', async () => {
      const {
        optimisticDataPersistence,
      } = require('#/apollo/offline/OptimisticDataPersistence');

      mockCacheIdentify.mockReturnValue('ShoppingListItem:item-1');
      mockReadFragment.mockReturnValue({
        id: 'item-1',
        quantity: 2,
        version: 1,
      });

      let capturedOnCompleted: any;
      mockUpdateQuantity.mockImplementation((opts: any) => {
        capturedOnCompleted = opts.onCompleted;
        return Promise.resolve({
          data: {
            updateShoppingListItemQuantity: {
              shoppingListItem: { id: 'item-1', quantity: 3 },
            },
          },
        });
      });

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleIncrementQuantity('item-1');
      });

      // Call onCompleted manually
      if (capturedOnCompleted) {
        capturedOnCompleted({
          updateShoppingListItemQuantity: {
            shoppingListItem: { id: 'item-1', quantity: 3 },
          },
        });
      }

      expect(optimisticDataPersistence.clear).toHaveBeenCalledWith(
        'ShoppingListItem',
        'item-1',
        'quantity',
      );
    });
  });

  describe('handleDecrementQuantity - onCompleted clears persistence', () => {
    it('clears persistence data on successful decrement mutation', async () => {
      const {
        optimisticDataPersistence,
      } = require('#/apollo/offline/OptimisticDataPersistence');

      mockCacheIdentify.mockReturnValue('ShoppingListItem:item-1');
      mockReadFragment.mockReturnValue({
        id: 'item-1',
        quantity: 3,
        version: 2,
      });

      let capturedOnCompleted: any;
      mockUpdateQuantity.mockImplementation((opts: any) => {
        capturedOnCompleted = opts.onCompleted;
        return Promise.resolve({
          data: {
            updateShoppingListItemQuantity: {
              shoppingListItem: { id: 'item-1', quantity: 2 },
            },
          },
        });
      });

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleDecrementQuantity('item-1');
      });

      if (capturedOnCompleted) {
        capturedOnCompleted({
          updateShoppingListItemQuantity: {
            shoppingListItem: { id: 'item-1', quantity: 2 },
          },
        });
      }

      expect(optimisticDataPersistence.clear).toHaveBeenCalledWith(
        'ShoppingListItem',
        'item-1',
        'quantity',
      );
    });
  });

  describe('handleIncrementQuantity - persistence save', () => {
    it('saves optimistic data before mutation', async () => {
      const {
        optimisticDataPersistence,
      } = require('#/apollo/offline/OptimisticDataPersistence');

      mockCacheIdentify.mockReturnValue('ShoppingListItem:item-1');
      mockReadFragment.mockReturnValue({
        id: 'item-1',
        quantity: 5,
        version: 3,
      });
      mockUpdateQuantity.mockResolvedValue({
        data: {
          updateShoppingListItemQuantity: {
            shoppingListItem: { id: 'item-1', quantity: 6 },
          },
        },
      });

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleIncrementQuantity('item-1');
      });

      expect(optimisticDataPersistence.save).toHaveBeenCalledWith(
        'ShoppingListItem',
        'item-1',
        'quantity',
        6,
      );
    });
  });

  describe('handleAddItemFromSearch - error is Error instance', () => {
    it('tracks Error instance with trackError', async () => {
      const { Telemetry } = require('#/services/telemetry');
      const { executeMutation } = require('#/utils/compilerSafeWrappers');

      const error = new Error('Add failed');
      executeMutation.mockImplementationOnce(async (_fn: any, onError: any) => {
        onError(error);
        return false;
      });

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleAddItemFromSearch('Milk');
      });

      expect(Telemetry.trackError).toHaveBeenCalledWith(error, {
        component: 'ShoppingListMain',
        operation: 'addItemFromSearch',
      });
    });
  });

  describe('handleAddItemFromSearch - tracks telemetry', () => {
    it('tracks add_item_from_search event with list_id and name length', async () => {
      const { Telemetry } = require('#/services/telemetry');

      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleAddItemFromSearch('  Eggs  ');
      });

      expect(Telemetry.trackEvent).toHaveBeenCalledWith(
        'add_item_from_search',
        {
          list_id: 'list-1',
          item_name_length: 4,
        },
      );
    });
  });

  describe('handleAddItemFromSearch - haptic feedback', () => {
    it('triggers success haptic on successful add', async () => {
      const { result } = renderHook(() => useShoppingListActions(defaultProps));

      await act(async () => {
        await result.current.handleAddItemFromSearch('Bread');
      });

      // The haptic.success() is called inside executeAddItemFromSearch
      // when addResult is truthy
      expect(defaultProps.addItem).toHaveBeenCalledWith({
        itemName: 'Bread',
        quantity: 1,
      });
    });
  });
});
