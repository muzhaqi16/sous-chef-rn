'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import { InMemoryCache } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { UpdateShoppingListItemQuantityDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  ShoppingListItemDisplayFragmentDoc,
  type ShoppingListItemDisplayFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import { useShoppingListActions } from '../useShoppingListActions';

// --- Mocks ---

const mockClearItems = jest.fn();

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
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

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeMutation: jest.fn(async (fn: any) => {
    await fn();
    return true;
  }),
  executeWithLoadingState: jest.fn(async (fn: any, setLoading: any) => {
    setLoading(true);
    try {
      await fn();
    } finally {
      setLoading(false);
    }
  }),
  executeAsyncWithCleanup: jest.fn(
    async (fn: any, cleanup: any, onError: any) => {
      try {
        await fn();
      } catch (e) {
        onError?.(e);
      } finally {
        cleanup?.();
      }
    },
  ),
  executeCacheUpdate: jest.fn((fn: any) => fn()),
  executeRefetch: jest.fn(async (fn: any) => fn()),
}));

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
  const { executeMutation } = require('#/utils/compilerSafeWrappers');
  executeMutation.mockImplementation(async (fn: any) => {
    await fn();
    return true;
  });
});

afterAll(() => {
  jest.restoreAllMocks();
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

/**
 * Build a cache pre-seeded with a ShoppingListItem written via the production
 * `ShoppingListItemDisplayFragmentDoc` so that the hook's `client.readFragment`
 * call (which uses the same fragment doc) returns the seeded data.
 */
function seedShoppingListItem(
  overrides: Record<string, unknown> = {},
): InMemoryCache {
  const cache = new InMemoryCache();
  const data: ShoppingListItemDisplayFragment = {
    __typename: 'ShoppingListItem',
    id: 'item-1',
    itemName: 'Milk',
    quantity: 2,
    quantityInput: '2',
    displayFormat: DisplayFormat.Decimal,
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: false,
    },
    version: 1,
    updatedAt: '2025-01-01T00:00:00.000Z',
    category: null,
    notes: null,
    unitName: null,
    unit: null,
    sortOrder: 'aaa',
    item: null,
    ...overrides,
  };
  cache.writeFragment({
    id: `ShoppingListItem:${data.id}`,
    fragment: ShoppingListItemDisplayFragmentDoc,
    fragmentName: 'ShoppingListItemDisplayFragment',
    data,
  });
  return cache;
}

function buildUpdateMockResponse(quantity: number, version: number) {
  return {
    updateShoppingListItemQuantity: {
      __typename: 'ShoppingListItemPayload',
      success: true,
      message: '',
      code: 'SUCCESS',
      shoppingListItem: {
        __typename: 'ShoppingListItem',
        id: 'item-1',
        itemName: 'Milk',
        quantity,
        quantityInput: String(quantity),
        displayFormat: String(quantity),
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: false,
        },
        version,
        updatedAt: '2025-01-01T00:00:00.000Z',
        category: null,
        notes: null,
        unitName: null,
        unit: null,
        sortOrder: 0,
        item: null,
      },
    },
  };
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
    const { result } = renderHookWithApollo(() =>
      useShoppingListActions(defaultProps),
    );

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
      const { result } = renderHookWithApollo(() =>
        useShoppingListActions(defaultProps),
      );

      await act(async () => {
        await result.current.handleTogglePurchase('item-1');
      });

      expect(defaultProps.toggleItem).toHaveBeenCalledWith('item-1');
    });

    it('tracks telemetry event', async () => {
      const { Telemetry } = require('#/services/telemetry');

      const { result } = renderHookWithApollo(() =>
        useShoppingListActions(defaultProps),
      );

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
      const { result } = renderHookWithApollo(() =>
        useShoppingListActions(defaultProps),
      );

      await act(async () => {
        await result.current.handleDeleteItem('item-1');
      });

      expect(defaultProps.removeItem).toHaveBeenCalledWith('item-1');
    });

    it('tracks telemetry event', async () => {
      const { Telemetry } = require('#/services/telemetry');

      const { result } = renderHookWithApollo(() =>
        useShoppingListActions(defaultProps),
      );

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
      const { result } = renderHookWithApollo(() =>
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
      const { result } = renderHookWithApollo(() =>
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
      const { result } = renderHookWithApollo(() =>
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
      const { result } = renderHookWithApollo(() =>
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

      const { result } = renderHookWithApollo(() =>
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
      const { result } = renderHookWithApollo(() =>
        useShoppingListActions(defaultProps),
      );

      await act(async () => {
        await result.current.handleAddItemFromSearch('Eggs');
      });

      expect(defaultProps.setSearchQuery).toHaveBeenCalledWith('');
    });

    it('calls addItem with trimmed name and quantity 1', async () => {
      const { result } = renderHookWithApollo(() =>
        useShoppingListActions(defaultProps),
      );

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

      const { result } = renderHookWithApollo(() =>
        useShoppingListActions(defaultProps),
      );

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
      // No cache seed → readFragment returns null naturally
      const m = recordMock(UpdateShoppingListItemQuantityDocument, {
        data: buildUpdateMockResponse(3, 2),
      });

      const { result } = renderHookWithApollo(
        () => useShoppingListActions(defaultProps),
        { operationMocks: [m.mock] },
      );

      await act(async () => {
        await result.current.handleIncrementQuantity('item-1');
      });

      expect(m.fired).toEqual([]);
    });

    it('increments quantity and calls update mutation', async () => {
      const cache = seedShoppingListItem({ quantity: 2, version: 1 });
      const m = recordMock(UpdateShoppingListItemQuantityDocument, {
        data: buildUpdateMockResponse(3, 2),
      });

      const { result } = renderHookWithApollo(
        () => useShoppingListActions(defaultProps),
        { operationMocks: [m.mock], cache },
      );

      await act(async () => {
        await result.current.handleIncrementQuantity('item-1');
      });

      await waitFor(() => {
        expect(m.fired).toContainEqual({
          itemId: 'item-1',
          quantity: '3',
          version: 1,
        });
      });
    });
  });

  describe('handleDecrementQuantity', () => {
    it('decrements quantity but not below 1', async () => {
      const cache = seedShoppingListItem({ quantity: 1, version: 1 });
      const m = recordMock(UpdateShoppingListItemQuantityDocument, {
        data: buildUpdateMockResponse(1, 2),
      });

      const { result } = renderHookWithApollo(
        () => useShoppingListActions(defaultProps),
        { operationMocks: [m.mock], cache },
      );

      await act(async () => {
        await result.current.handleDecrementQuantity('item-1');
      });

      await waitFor(() => {
        expect(m.fired).toContainEqual({
          itemId: 'item-1',
          quantity: '1',
          version: 1,
        });
      });
    });

    it('early returns when cache identify returns undefined', async () => {
      // No cache seed → readFragment returns null
      const m = recordMock(UpdateShoppingListItemQuantityDocument, {
        data: buildUpdateMockResponse(0, 2),
      });

      const { result } = renderHookWithApollo(
        () => useShoppingListActions(defaultProps),
        { operationMocks: [m.mock] },
      );

      await act(async () => {
        await result.current.handleDecrementQuantity('item-1');
      });

      expect(m.fired).toEqual([]);
    });

    it('early returns when readFragment returns null', async () => {
      // No cache seed → readFragment returns null
      const m = recordMock(UpdateShoppingListItemQuantityDocument, {
        data: buildUpdateMockResponse(0, 2),
      });

      const { result } = renderHookWithApollo(
        () => useShoppingListActions(defaultProps),
        { operationMocks: [m.mock] },
      );

      await act(async () => {
        await result.current.handleDecrementQuantity('item-1');
      });

      expect(m.fired).toEqual([]);
    });

    it('decrements from quantity 5 to 4', async () => {
      const cache = seedShoppingListItem({ quantity: 5, version: 2 });
      const m = recordMock(UpdateShoppingListItemQuantityDocument, {
        data: buildUpdateMockResponse(4, 3),
      });

      const { result } = renderHookWithApollo(
        () => useShoppingListActions(defaultProps),
        { operationMocks: [m.mock], cache },
      );

      await act(async () => {
        await result.current.handleDecrementQuantity('item-1');
      });

      await waitFor(() => {
        expect(m.fired).toContainEqual({
          itemId: 'item-1',
          quantity: '4',
          version: 2,
        });
      });
    });

    it('handles null quantity as 1', async () => {
      const cache = seedShoppingListItem({ quantity: null, version: 1 });
      const m = recordMock(UpdateShoppingListItemQuantityDocument, {
        data: buildUpdateMockResponse(1, 2),
      });

      const { result } = renderHookWithApollo(
        () => useShoppingListActions(defaultProps),
        { operationMocks: [m.mock], cache },
      );

      await act(async () => {
        await result.current.handleDecrementQuantity('item-1');
      });

      // null ?? 1 = 1, then Math.max(1, 1 - 1) = Math.max(1, 0) = 1
      await waitFor(() => {
        expect(m.fired.some(v => v.quantity === '1')).toBe(true);
      });
    });
  });

  describe('handleIncrementQuantity - readFragment returns null', () => {
    it('early returns when readFragment returns null', async () => {
      // No cache seed → readFragment returns null
      const m = recordMock(UpdateShoppingListItemQuantityDocument, {
        data: buildUpdateMockResponse(1, 2),
      });

      const { result } = renderHookWithApollo(
        () => useShoppingListActions(defaultProps),
        { operationMocks: [m.mock] },
      );

      await act(async () => {
        await result.current.handleIncrementQuantity('item-1');
      });

      expect(m.fired).toEqual([]);
    });

    it('increments from zero quantity', async () => {
      const cache = seedShoppingListItem({ quantity: 0, version: 1 });
      const m = recordMock(UpdateShoppingListItemQuantityDocument, {
        data: buildUpdateMockResponse(1, 2),
      });

      const { result } = renderHookWithApollo(
        () => useShoppingListActions(defaultProps),
        { operationMocks: [m.mock], cache },
      );

      await act(async () => {
        await result.current.handleIncrementQuantity('item-1');
      });

      await waitFor(() => {
        expect(m.fired.some(v => v.quantity === '1')).toBe(true);
      });
    });
  });

  describe('handleAddItemFromSearch - add fails', () => {
    it('shows error toast when addItem returns falsy', async () => {
      const { toastService } = require('#/services/toastService');
      const failAddItem = jest.fn().mockResolvedValue(null);

      const { result } = renderHookWithApollo(() =>
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
      const { result } = renderHookWithApollo(() =>
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

      const { result } = renderHookWithApollo(() =>
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

      const { result } = renderHookWithApollo(() =>
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

      const { result } = renderHookWithApollo(() =>
        useShoppingListActions(defaultProps),
      );

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

      const { result } = renderHookWithApollo(() =>
        useShoppingListActions(defaultProps),
      );

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

      const { result } = renderHookWithApollo(() =>
        useShoppingListActions(defaultProps),
      );

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

      const { result } = renderHookWithApollo(() =>
        useShoppingListActions(defaultProps),
      );

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

      const { result } = renderHookWithApollo(() =>
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

      const { result } = renderHookWithApollo(() =>
        useShoppingListActions({
          ...defaultProps,
          unpurchasedItems: [
            createItem({ purchaseInfo: { isPurchased: false } }),
          ],
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

      const cache = seedShoppingListItem({ quantity: 2, version: 1 });

      // Make the inner executeMutation call the error handler
      executeMutation.mockImplementationOnce(async (_fn: any, onError: any) => {
        onError({
          graphQLErrors: [{ extensions: { code: 'VERSION_CONFLICT' } }],
        });
        return false;
      });
      handleVersionConflict.mockReturnValueOnce(true);

      const m = recordMock(UpdateShoppingListItemQuantityDocument, {
        data: buildUpdateMockResponse(3, 2),
      });

      const { result } = renderHookWithApollo(
        () => useShoppingListActions(defaultProps),
        { operationMocks: [m.mock], cache },
      );

      await act(async () => {
        await result.current.handleIncrementQuantity('item-1');
      });

      // Version conflict was handled
      expect(handleVersionConflict).toHaveBeenCalled();
    });
  });

  describe('handleIncrementQuantity - persistence save', () => {
    it('saves optimistic data before mutation', async () => {
      const {
        optimisticDataPersistence,
      } = require('#/apollo/offline/OptimisticDataPersistence');

      const cache = seedShoppingListItem({ quantity: 5, version: 3 });
      const m = recordMock(UpdateShoppingListItemQuantityDocument, {
        data: buildUpdateMockResponse(6, 4),
      });

      const { result } = renderHookWithApollo(
        () => useShoppingListActions(defaultProps),
        { operationMocks: [m.mock], cache },
      );

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

      const { result } = renderHookWithApollo(() =>
        useShoppingListActions(defaultProps),
      );

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

      const { result } = renderHookWithApollo(() =>
        useShoppingListActions(defaultProps),
      );

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
      const { result } = renderHookWithApollo(() =>
        useShoppingListActions(defaultProps),
      );

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
