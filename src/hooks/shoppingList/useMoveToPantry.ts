import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import {
  useMoveShoppingItemToPantryMutation,
  StorageState,
  ShoppingListItemDisplayFragment,
} from '#generated';
import { Telemetry } from '#/services/telemetry';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';

export interface MoveToPantryInput {
  pantryId: string;
  actualQuantity: number;
  actualUnitId?: string;
  storageState?: StorageState;
  expiresAt?: string;
  removeFromList: boolean;
  actualPrice?: number;
  notes?: string;
}

interface UseMoveToPantryOptions {
  currentListId: string | undefined;
  onSuccess?: () => void;
}

/**
 * Hook for moving shopping list items to pantry
 * Handles mutation, cache updates, and optimistic UI updates
 */
export function useMoveToPantry({
  currentListId,
  onSuccess,
}: UseMoveToPantryOptions) {
  // Refs to track mutation input for cache update
  const moveToPantryIdRef = useRef<string | null>(null);
  const removeFromListRef = useRef<boolean>(true);
  const selectedItemRef = useRef<ShoppingListItemDisplayFragment | null>(null);

  // Move to pantry mutation with smart cache updates
  const [moveShoppingItemToPantry, { loading }] =
    useMoveShoppingItemToPantryMutation({
      update: (cache, { data }) => {
        if (!data?.moveShoppingItemToPantry || !moveToPantryIdRef.current)
          return;

        try {
          // Add to pantry items cache
          const addToPantryCache = createAddToParentConnectionUpdater(
            'Pantry',
            'itemsConnection',
            'PantryItem',
          );
          addToPantryCache(
            cache,
            moveToPantryIdRef.current,
            data.moveShoppingItemToPantry,
          );

          const selectedItem = selectedItemRef.current;
          if (!selectedItem || !currentListId) return;

          if (removeFromListRef.current) {
            // Remove from shopping list cache if removeFromList was true
            const removeFromShoppingListCache =
              createRemoveFromParentConnectionUpdater(
                'ShoppingList',
                'itemsConnection',
                'ShoppingListItem',
              );
            removeFromShoppingListCache(cache, currentListId, selectedItem.id);
          } else {
            // If keeping in list, mark as unpurchased in cache (server does this automatically)
            const cacheId = cache.identify({
              __typename: 'ShoppingListItem',
              id: selectedItem.id,
            });
            if (cacheId) {
              cache.modify({
                id: cacheId,
                fields: {
                  isPurchased() {
                    return false;
                  },
                  version(existingVersion) {
                    return (existingVersion ?? 0) + 1;
                  },
                  updatedAt() {
                    return new Date().toISOString();
                  },
                },
              });
            }
          }
        } catch (error) {
          console.warn(
            'Cache update failed for moveShoppingItemToPantry:',
            error,
          );
        }
      },
      onCompleted: () => {
        onSuccess?.();
      },
      onError: error => {
        Alert.alert('Error', error.message || 'Failed to move item to pantry');
      },
    });

  /**
   * Move a shopping list item to pantry
   */
  const moveToPantry = useCallback(
    async (item: ShoppingListItemDisplayFragment, input: MoveToPantryInput) => {
      // Store refs for cache update
      selectedItemRef.current = item;
      moveToPantryIdRef.current = input.pantryId;
      removeFromListRef.current = input.removeFromList;

      try {
        await moveShoppingItemToPantry({
          variables: {
            input: {
              shoppingListItemId: item.id,
              pantryId: input.pantryId,
              actualQuantity: input.actualQuantity,
              actualUnitId: input.actualUnitId,
              storageState: input.storageState,
              expiresAt: input.expiresAt,
              removeFromList: input.removeFromList,
              actualPrice: input.actualPrice,
              notes: input.notes,
            },
          },
        });

        Telemetry.trackEvent('shopping_item_moved_to_pantry', {
          shopping_list_id: currentListId,
          pantry_id: input.pantryId,
          remove_from_list: input.removeFromList,
        });

        return true;
      } catch (error) {
        console.error('Failed to move item to pantry:', error);
        return false;
      }
    },
    [moveShoppingItemToPantry, currentListId],
  );

  return {
    moveToPantry,
    loading,
  };
}
