import { useCallback } from 'react';
import { Alert } from 'react-native';

interface PurchasedItem {
  id: string;
  purchaseInfo?: {
    isPurchased?: boolean;
  };
}

interface UsePurchasedItemsManagementOptions<T extends PurchasedItem> {
  /**
   * Array of shopping list items
   */
  items: T[];

  /**
   * Function to toggle an item's purchased status
   */
  toggleItem: (itemId: string) => Promise<any>;

  /**
   * Function to remove an item from the list
   */
  removeItem: (itemId: string) => Promise<any>;

  /**
   * Haptic feedback interface
   */
  haptic: {
    light: () => void;
    warning: () => void;
    error: () => void;
  };
}

/**
 * Hook to manage purchased items in a shopping list
 *
 * Provides handlers for:
 * - Toggling purchase status with haptic feedback
 * - Clearing all purchased items at once
 *
 * @param options - Configuration options
 * @returns Object with toggle and clear handlers
 *
 * @example
 * ```typescript
 * const { handleTogglePurchase, handleClearAllPurchased } = usePurchasedItemsManagement({
 *   items: shoppingListItems,
 *   toggleItem: toggleItemMutation,
 *   removeItem: removeItemMutation,
 *   haptic: hapticInstance,
 * });
 *
 * <ShoppingListItem
 *   onToggle={() => handleTogglePurchase(item.id)}
 * />
 * <Button onPress={handleClearAllPurchased}>Clear Purchased</Button>
 * ```
 */
export function usePurchasedItemsManagement<T extends PurchasedItem>(
  options: UsePurchasedItemsManagementOptions<T>,
) {
  const { items, toggleItem, removeItem, haptic } = options;

  /**
   * Toggle an item's purchased status with haptic feedback
   *
   * Provides light haptic feedback when toggling to enhance
   * the user experience.
   *
   * @param itemId - Shopping list item ID
   */
  const handleTogglePurchase = useCallback(
    async (itemId: string) => {
      haptic.light(); // Light haptic on toggle
      await toggleItem(itemId);
    },
    [toggleItem, haptic],
  );

  /**
   * Clear all purchased items from the shopping list
   *
   * Removes all items marked as purchased in a single operation.
   * Shows an error alert if the operation fails.
   * Returns early if there are no purchased items.
   */
  const handleClearAllPurchased = useCallback(async () => {
    const purchasedItems = items.filter(item => item.purchaseInfo?.isPurchased);

    if (purchasedItems.length === 0) return;

    try {
      // Delete all purchased items in parallel
      await Promise.all(purchasedItems.map(item => removeItem(item.id)));

      // OPTIMIZATION: No refetch needed - each removeItem updates cache via cache.modify
      // Cache automatically updates via Apollo's normalized cache
    } catch (error) {
      Alert.alert('Error', 'Failed to clear purchased items');
    }
  }, [items, removeItem]);

  return {
    handleTogglePurchase,
    handleClearAllPurchased,
  };
}
