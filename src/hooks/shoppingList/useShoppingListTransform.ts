import { useMemo } from 'react';
import { getItemImageUrl } from '#utils/imageUtils';
import type { ShoppingListItemDisplayFragment } from '#generated';
import type {
  SortableShoppingListItem,
  QuantityElementConfig,
  ImageElementConfig,
} from '#components/organisms/SortableShoppingList/types';

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
) {
  // Transform items to sortable format with configs
  const sortableItems = useMemo((): SortableShoppingListItem[] => {
    return items.map((item): SortableShoppingListItem => {
      const imageUrl = getItemImageUrl(item.item);

      // Create quantity config
      // unitName from server now includes item-specific display name
      // (e.g., "pineapples" instead of generic "count")
      const rightElementConfig: QuantityElementConfig = {
        type: 'quantity',
        quantity: item.quantity || 0,
        quantityInput: item.quantityInput,
        unit: item.unitName || item.unit?.symbol || undefined,
        itemId: item.id,
        disabled: item.purchaseInfo?.isPurchased ?? false,
      };

      // Create image config (only if image exists)
      const leftElementConfig: ImageElementConfig | undefined = imageUrl
        ? {
            type: 'image',
            url: imageUrl,
            isPurchased: item.purchaseInfo?.isPurchased,
          }
        : undefined;

      return {
        id: item.id,
        title: item.itemName || '',
        subtitle: item.category || undefined,
        sortOrder: item.sortOrder ?? 'zzz', // String fallback for fractional indexing
        isPurchased: item.purchaseInfo?.isPurchased,
        rightElementConfig,
        leftElementConfig,
      };
    });
  }, [items]);

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
