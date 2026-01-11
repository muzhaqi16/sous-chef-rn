import { useMemo } from 'react';
import { getItemImageUrl } from '#utils/imageUtils';
import type { ShoppingListItemDisplayFragment } from '#generated';
import type {
  SortableShoppingListItem,
  QuantityElementConfig,
  ImageElementConfig,
} from '#components/organisms/SortableShoppingList/types';

interface TransformOptions {
  /**
   * Force the isPurchased state for all items.
   * Use this when items are already filtered by purchase status
   * to ensure checkbox state matches the tab they're in.
   */
  forcePurchasedState?: boolean;
}

/**
 * useShoppingListTransform - Transform raw items to SortableShoppingListItem
 *
 * Single responsibility:
 * - Transform ShoppingListItemDisplayFragment[] to SortableShoppingListItem[]
 * - Create config objects for quantity and image elements
 * - Partition items by purchase status
 *
 * This hook removes the need for ref-based caching by relying on:
 * 1. useMemo for transformation (recalculates only when items change)
 * 2. React.memo on child components with stable keys
 * 3. Accepting that config objects are recreated when item data changes (which is correct behavior)
 */
export function useShoppingListTransform(
  items: ShoppingListItemDisplayFragment[],
  options?: TransformOptions,
) {
  const { forcePurchasedState } = options ?? {};
  // Transform items to sortable format with configs
  // Filter out items with missing essential data to prevent empty item renders
  const sortableItems = useMemo((): SortableShoppingListItem[] => {
    return items
      .filter((item) => {
        // Skip items without ID or name (invalid/corrupt data)
        if (!item.id || !item.itemName) {
          if (__DEV__) {
            console.warn('⚠️ Skipping invalid shopping list item:', item.id);
          }
          return false;
        }
        return true;
      })
      .map((item): SortableShoppingListItem => {
      const imageUrl = getItemImageUrl(item.item);

      // Use forced state if provided, otherwise read from server data
      // This ensures checkbox state matches the tab items are displayed in
      const isPurchasedValue =
        forcePurchasedState ?? item.purchaseInfo?.isPurchased;

      // Create quantity config
      // unitName from server now includes item-specific display name
      // (e.g., "pineapples" instead of generic "count")
      const rightElementConfig: QuantityElementConfig = {
        type: 'quantity',
        quantity: item.quantity || 0,
        quantityInput: item.quantityInput,
        unit: item.unitName || item.unit?.symbol || undefined,
        itemId: item.id,
        disabled: isPurchasedValue ?? false,
      };

      // Create image config (only if image exists)
      const leftElementConfig: ImageElementConfig | undefined = imageUrl
        ? {
            type: 'image',
            url: imageUrl,
            isPurchased: isPurchasedValue,
          }
        : undefined;

      return {
        id: item.id,
        title: item.itemName || '',
        subtitle: item.category || undefined,
        sortOrder: item.sortOrder ?? 'zzz', // String fallback for fractional indexing
        isPurchased: isPurchasedValue,
        rightElementConfig,
        leftElementConfig,
      };
    });
  }, [items, forcePurchasedState]);

  // Partition by purchase status
  const { unpurchasedItems, purchasedItems } = useMemo(
    () => ({
      unpurchasedItems: sortableItems.filter(item => !item.isPurchased),
      purchasedItems: sortableItems.filter(item => item.isPurchased),
    }),
    [sortableItems],
  );

  return {
    sortableItems,
    unpurchasedItems,
    purchasedItems,
  };
}
