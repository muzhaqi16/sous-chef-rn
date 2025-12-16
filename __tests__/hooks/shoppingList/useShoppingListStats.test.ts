import { renderHook } from '@testing-library/react-native';
import { useShoppingListStats } from '../../../src/hooks/shoppingList/useShoppingListStats';
import type { ShoppingListItemCoreFragment } from '#/graphql/generated/types';

// Helper to create mock shopping list items
const createMockItem = (
  overrides?: Partial<ShoppingListItemCoreFragment>,
): ShoppingListItemCoreFragment =>
  ({
    __typename: 'ShoppingListItem',
    id: Math.random().toString(),
    itemName: 'Test Item',
    quantity: 1,
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: false,
      purchasedQuantity: null,
      purchasedPrice: null,
      purchaseDate: null,
      purchasedBy: null,
    },
    updatedAt: new Date().toISOString(),
    version: 1,
    // Add required fields from fragment
    unit: null,
    displayFormat: 'DECIMAL',
    shoppingList: {
      __typename: 'ShoppingList',
      id: 'list-1',
    },
    pantryItem: null,
    ...overrides,
  }) as unknown as ShoppingListItemCoreFragment;

describe('useShoppingListStats', () => {
  describe('with empty list', () => {
    it('returns zero stats', () => {
      const { result } = renderHook(() => useShoppingListStats([]));

      expect(result.current).toEqual({
        total: 0,
        completed: 0,
        pending: 0,
        completionRate: 0,
      });
    });
  });

  describe('with all items pending', () => {
    it('returns correct stats', () => {
      const items = [
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        }),
      ];

      const { result } = renderHook(() => useShoppingListStats(items));

      expect(result.current).toEqual({
        total: 3,
        completed: 0,
        pending: 3,
        completionRate: 0,
      });
    });
  });

  describe('with all items completed', () => {
    it('returns 100% completion rate', () => {
      const items = [
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
      ];

      const { result } = renderHook(() => useShoppingListStats(items));

      expect(result.current).toEqual({
        total: 3,
        completed: 3,
        pending: 0,
        completionRate: 100,
      });
    });
  });

  describe('with mixed items', () => {
    it('calculates correct completion rate for 50%', () => {
      const items = [
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        }),
      ];

      const { result } = renderHook(() => useShoppingListStats(items));

      expect(result.current).toEqual({
        total: 4,
        completed: 2,
        pending: 2,
        completionRate: 50,
      });
    });

    it('rounds completion rate to nearest integer (33%)', () => {
      const items = [
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        }),
      ];

      const { result } = renderHook(() => useShoppingListStats(items));

      expect(result.current).toEqual({
        total: 3,
        completed: 1,
        pending: 2,
        completionRate: 33, // Math.round(33.33)
      });
    });

    it('rounds completion rate to nearest integer (67%)', () => {
      const items = [
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        }),
      ];

      const { result } = renderHook(() => useShoppingListStats(items));

      expect(result.current).toEqual({
        total: 3,
        completed: 2,
        pending: 1,
        completionRate: 67, // Math.round(66.67)
      });
    });

    it('calculates correct stats for large list', () => {
      const listItems = [
        ...Array(70).fill(null).map(() => createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        })),
        ...Array(30).fill(null).map(() => createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        })),
      ];

      const { result } = renderHook(() => useShoppingListStats(listItems));

      expect(result.current).toEqual({
        total: 100,
        completed: 70,
        pending: 30,
        completionRate: 70,
      });
    });
  });

  describe('null safety and cache corruption handling', () => {
    it('handles null items gracefully', () => {
      // Type assertion to test defensive null handling
      const items = [
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
        null as any,
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        }),
        null as any,
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
      ];

      const { result } = renderHook(() => useShoppingListStats(items));

      // Should filter out null items when checking isPurchased
      expect(result.current).toEqual({
        total: 5, // Still counts null entries in total (length)
        completed: 2, // Only counts truthy items with isPurchased=true
        pending: 3, // total - completed
        completionRate: 40, // Math.round(2/5 * 100)
      });
    });

    it('handles undefined isPurchased property', () => {
      const items = [
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: undefined as any,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        }),
      ];

      const { result } = renderHook(() => useShoppingListStats(items));

      expect(result.current).toEqual({
        total: 3,
        completed: 1, // undefined is falsy, so not counted
        pending: 2,
        completionRate: 33,
      });
    });
  });

  describe('memoization', () => {
    it('returns same reference when items array reference unchanged', () => {
      const items = [
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        }),
      ];

      const { result, rerender } = renderHook(
        (props: { listItems: ShoppingListItemCoreFragment[] }) =>
          useShoppingListStats(props.listItems),
        { initialProps: { listItems: items } },
      );

      const firstResult = result.current;
      rerender({ listItems: items }); // Same reference
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult); // Same object reference
    });

    it('recalculates when items array reference changes', () => {
      const items1 = [
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        }),
      ];

      const { result, rerender } = renderHook(
        (props: { items: ShoppingListItemCoreFragment[] }) =>
          useShoppingListStats(props.items),
        { initialProps: { items: items1 } },
      );

      const firstResult = result.current;

      const items2 = [
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
        createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }),
      ];
      rerender({ items: items2 });
      const secondResult = result.current;

      expect(firstResult).not.toBe(secondResult); // Different object reference
      expect(firstResult.completionRate).toBe(50);
      expect(secondResult.completionRate).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('handles single item - completed', () => {
      const items = [createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        })];

      const { result } = renderHook(() => useShoppingListStats(items));

      expect(result.current).toEqual({
        total: 1,
        completed: 1,
        pending: 0,
        completionRate: 100,
      });
    });

    it('handles single item - pending', () => {
      const items = [createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        })];

      const { result } = renderHook(() => useShoppingListStats(items));

      expect(result.current).toEqual({
        total: 1,
        completed: 0,
        pending: 1,
        completionRate: 0,
      });
    });

    it('handles very large completion rates without overflow', () => {
      const items = Array(10000)
        .fill(null)
        .map(() => createMockItem({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
          },
        }));

      const { result } = renderHook(() => useShoppingListStats(items));

      expect(result.current).toEqual({
        total: 10000,
        completed: 10000,
        pending: 0,
        completionRate: 100,
      });
    });
  });
});
