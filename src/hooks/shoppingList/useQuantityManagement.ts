import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useApolloClient } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useUpdateShoppingListItemQuantityMutation } from '#generated';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { FRAGMENT_NAMES } from '#/constants/shoppingList';

interface CachedItemData {
  id: string;
  version: number;
  quantity: number;
}

interface UseQuantityManagementOptions {
  /**
   * Callback to refetch items after version conflict
   */
  onRefetch?: () => void;
}

/**
 * Hook to manage shopping list item quantities
 *
 * Provides increment and decrement handlers with:
 * - Fresh cache reads to avoid stale closure issues
 * - Version conflict handling with user alerts
 * - Error handling and user feedback
 * - Optimistic updates via Apollo
 *
 * @param options - Configuration options
 * @returns Object with increment and decrement handlers
 *
 * @example
 * ```typescript
 * const { incrementQuantity, decrementQuantity } = useQuantityManagement({
 *   onRefetch: refetchItems,
 * });
 *
 * <ShoppingListItem
 *   onIncrement={() => incrementQuantity(item.id)}
 *   onDecrement={() => decrementQuantity(item.id)}
 * />
 * ```
 */
export function useQuantityManagement(
  options: UseQuantityManagementOptions = {},
) {
  const { onRefetch } = options;
  const client = useApolloClient();
  const [updateQuantity] = useUpdateShoppingListItemQuantityMutation();

  /**
   * Read fresh item data from Apollo cache
   *
   * @param itemId - Shopping list item ID
   * @param fragmentName - GraphQL fragment name to use
   * @returns Cached item data or null if not found
   */
  const readItemFromCache = useCallback(
    (itemId: string, fragmentName: string): CachedItemData | null => {
      return client.readFragment({
        id: client.cache.identify({
          __typename: 'ShoppingListItem',
          id: itemId,
        }),
        fragment: gql`
          fragment ${fragmentName} on ShoppingListItem {
            id
            version
            quantity
          }
        `,
      }) as CachedItemData | null;
    },
    [client],
  );

  /**
   * Update item quantity with error handling
   *
   * @param itemId - Shopping list item ID
   * @param newQuantity - New quantity value
   * @param version - Current version for optimistic concurrency
   */
  const updateItemQuantity = useCallback(
    async (itemId: string, newQuantity: number, version: number) => {
      try {
        await updateQuantity({
          variables: {
            itemId,
            quantity: newQuantity.toString(),
            version,
          },
        });
      } catch (error: any) {
        if (handleVersionConflict(error)) {
          Alert.alert('Item Updated', getVersionConflictMessage(error), [
            { text: 'Refresh', onPress: onRefetch },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        console.error('Failed to update quantity:', error);
        Alert.alert('Error', 'Failed to update quantity');
      }
    },
    [updateQuantity, onRefetch],
  );

  /**
   * Increment item quantity by 1
   *
   * Reads fresh data from cache to avoid stale closures,
   * then updates with incremented quantity.
   *
   * @param itemId - Shopping list item ID
   */
  const incrementQuantity = useCallback(
    async (itemId: string) => {
      const cachedItem = readItemFromCache(
        itemId,
        FRAGMENT_NAMES.ITEM_VERSION_DATA,
      );

      if (!cachedItem) {
        return;
      }

      await updateItemQuantity(
        itemId,
        (cachedItem.quantity || 1) + 1,
        cachedItem.version,
      );
    },
    [readItemFromCache, updateItemQuantity],
  );

  /**
   * Decrement item quantity by 1 (minimum 0)
   *
   * Reads fresh data from cache to avoid stale closures,
   * then updates with decremented quantity.
   *
   * @param itemId - Shopping list item ID
   */
  const decrementQuantity = useCallback(
    async (itemId: string) => {
      const cachedItem = readItemFromCache(
        itemId,
        FRAGMENT_NAMES.ITEM_VERSION_DATA_2,
      );

      if (!cachedItem) {
        return;
      }

      await updateItemQuantity(
        itemId,
        Math.max(0, (cachedItem.quantity || 1) - 1),
        cachedItem.version,
      );
    },
    [readItemFromCache, updateItemQuantity],
  );

  return {
    incrementQuantity,
    decrementQuantity,
  };
}
