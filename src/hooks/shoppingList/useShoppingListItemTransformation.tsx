import React, { useMemo } from 'react';
import { View, Image } from 'react-native';
import { getItemImageUrl } from '#utils/imageUtils';
import { ShoppingListItemCounter } from '#/components/molecules/ShoppingListItemCounter';
import { commonStyles } from '#/styles';
import type { SortableShoppingListItem } from '#components/organisms/SortableShoppingList';

interface ShoppingListItem {
  id: string;
  itemName: string | null | undefined;
  quantity?: number | null;
  sortOrder?: string | null;
  isPurchased: boolean;
  category?: string | null;
  item?: {
    categories?: Array<{
      isPrimary: boolean;
      category?: {
        name?: string;
      } | null;
    }> | null;
  } | null;
}

interface UseShoppingListItemTransformationOptions<T extends ShoppingListItem> {
  /**
   * Array of shopping list items to transform
   */
  items: T[];

  /**
   * Function to increment item quantity
   */
  incrementQuantity: (itemId: string) => void;

  /**
   * Function to decrement item quantity
   */
  decrementQuantity: (itemId: string) => void;
}

/**
 * Hook to transform raw shopping list items into sortable display items
 *
 * Transforms shopping list items by:
 * - Separating unpurchased and purchased items
 * - Maintaining server sort order within each group
 * - Extracting category information
 * - Adding quantity counter components
 * - Including item images when available
 * - Applying purchased item styling (opacity)
 *
 * @param options - Configuration options
 * @returns Array of transformed items ready for SortableShoppingList
 *
 * @example
 * ```typescript
 * const sortableItems = useShoppingListItemTransformation({
 *   items: shoppingListItems,
 *   incrementQuantity: handleIncrement,
 *   decrementQuantity: handleDecrement,
 * });
 *
 * <SortableShoppingList items={sortableItems} />
 * ```
 */
export function useShoppingListItemTransformation<T extends ShoppingListItem>(
  options: UseShoppingListItemTransformationOptions<T>,
): SortableShoppingListItem[] {
  const { items, incrementQuantity, decrementQuantity } = options;

  return useMemo((): SortableShoppingListItem[] => {
    // Server already returns items sorted by: isPurchased ASC, sortOrder ASC, createdAt ASC
    // No need to re-sort on client - just separate by purchased status for UI
    const unpurchasedItems = items.filter(item => !item.isPurchased);
    const purchasedItems = items.filter(item => item.isPurchased);

    // Unpurchased first, then purchased (already sorted within each group by server)
    const sortedItems = [...unpurchasedItems, ...purchasedItems];

    // Map to SortableShoppingListItem format
    return sortedItems.map(item => {
      const imageUrl = getItemImageUrl(item.item);

      // Only use user-set category, don't fall back to item.item.categories
      // (item.item.categories is for autocomplete suggestions, not display)
      const categoryName = item.category;

      return {
        id: item.id,
        title: item.itemName ?? '',
        subtitle: categoryName || undefined,
        sortOrder: item.sortOrder ?? 'zzz', // String fallback for fractional indexing
        isPurchased: item.isPurchased,
        badge: undefined,
        rightElement: (
          <ShoppingListItemCounter
            quantity={item.quantity || 0}
            onIncrement={() => incrementQuantity(item.id)}
            onDecrement={() => decrementQuantity(item.id)}
          />
        ),
        leftElement: imageUrl ? (
          <View
            style={[
              commonStyles.listItemImageContainer,
              item.isPurchased && { opacity: 0.5 },
            ]}
          >
            <Image
              source={{ uri: imageUrl }}
              style={commonStyles.listItemImage}
            />
          </View>
        ) : null,
      };
    });
  }, [items, incrementQuantity, decrementQuantity]);
}
