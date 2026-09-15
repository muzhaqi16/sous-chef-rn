'use no memo';

import { act } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useShoppingListActions } from '../useShoppingListActions';
import type { ShoppingListItemNode } from '../usePaginatedShoppingItems';

// --- Mocks ---

const mockClearItems = jest.fn();

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

jest.mock('#/utils/finallyHelpers', () => ({
  executeWithLoadingState: jest.fn(
    async (fn: () => Promise<void>, setLoading: (value: boolean) => void) => {
      setLoading(true);
      try {
        await fn();
      } finally {
        setLoading(false);
      }
    },
  ),
  executeAsyncWithCleanup: jest.fn(
    async (
      fn: () => Promise<void>,
      cleanup: () => void,
      onError?: (error: unknown) => void,
    ) => {
      try {
        await fn();
      } catch (e) {
        onError?.(e);
      } finally {
        cleanup?.();
      }
    },
  ),
}));

jest.mock('#services/haptic/HapticService', () => ({
  HapticService: {
    selection: jest.fn(),
    warning: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    light: jest.fn(),
    medium: jest.fn(),
    heavy: jest.fn(),
  },
}));

jest.mock('../mutations/useClearShoppingListItems', () => ({
  useClearShoppingListItems: () => ({
    clearItems: mockClearItems,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
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
  } as Partial<ShoppingListItemNode> as ShoppingListItemNode;
}

describe('useShoppingListActions', () => {
  const defaultProps = {
    currentListId: 'list-1',
    unpurchasedItems: [createItem()],
    purchasedItems: [] as ShoppingListItemNode[],
    toggleItem: jest.fn().mockResolvedValue(true),
    removeItem: jest.fn().mockResolvedValue(true),
    refetchItems: jest.fn().mockResolvedValue(undefined),
  };

  it('returns all action handlers', () => {
    const { result } = renderHookWithApollo(() =>
      useShoppingListActions(defaultProps),
    );

    expect(typeof result.current.handleTogglePurchase).toBe('function');
    expect(typeof result.current.handleDeleteItem).toBe('function');
    expect(typeof result.current.handleClearAllPurchased).toBe('function');
    expect(typeof result.current.handleClearAllShopping).toBe('function');
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

    it('records success only when the removal took effect', async () => {
      const { Telemetry } = require('#/services/telemetry');

      const refused = renderHookWithApollo(() =>
        useShoppingListActions({
          ...defaultProps,
          removeItem: jest.fn().mockResolvedValue(false),
        }),
      );
      await act(async () => {
        await refused.result.current.handleDeleteItem('item-1');
      });
      expect(Telemetry.trackEvent).not.toHaveBeenCalledWith(
        'delete_item_success',
      );

      const removed = renderHookWithApollo(() =>
        useShoppingListActions({
          ...defaultProps,
          removeItem: jest.fn().mockResolvedValue(true),
        }),
      );
      await act(async () => {
        await removed.result.current.handleDeleteItem('item-1');
      });
      expect(Telemetry.trackEvent).toHaveBeenCalledWith('delete_item_success');
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

  // ========== Additional branch/function coverage tests ==========

  describe('handleTogglePurchase - error path', () => {
    it('handles toggle error with haptic feedback and toast', async () => {
      const { toastService } = require('#/services/toastService');
      const { Telemetry } = require('#/services/telemetry');
      const { result } = renderHookWithApollo(() =>
        useShoppingListActions({
          ...defaultProps,
          toggleItem: jest.fn().mockRejectedValue(new Error('Toggle failed')),
        }),
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
      const { result } = renderHookWithApollo(() =>
        useShoppingListActions({
          ...defaultProps,
          removeItem: jest.fn().mockRejectedValue(new Error('Delete failed')),
        }),
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
      const { result } = renderHookWithApollo(() =>
        useShoppingListActions({
          ...defaultProps,
          removeItem: jest.fn().mockRejectedValue('string error'),
        }),
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
      const { result } = renderHookWithApollo(() =>
        useShoppingListActions({
          ...defaultProps,
          toggleItem: jest.fn().mockRejectedValue('string toggle error'),
        }),
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
      mockClearItems.mockRejectedValueOnce(new Error('Clear failed'));

      const { result } = renderHookWithApollo(() =>
        useShoppingListActions({
          ...defaultProps,
          purchasedItems: [createItem({ purchaseInfo: { isPurchased: true } })],
        }),
      );

      await act(async () => {
        await result.current.handleClearAllPurchased();
      });

      expect(toastService.error).toHaveBeenCalledWith('Failed to clear items');
    });
  });

  describe('handleClearAllShopping - error path', () => {
    it('handles clearItems error for unpurchased items', async () => {
      const { toastService } = require('#/services/toastService');
      mockClearItems.mockRejectedValueOnce(new Error('Clear failed'));

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

      expect(toastService.error).toHaveBeenCalledWith('Failed to clear items');
    });
  });
});
