import { useRef } from 'react';
import { alertService } from '#/services/alertService';
import { useMutation } from '@apollo/client/react';
import { MoveShoppingItemToPantryDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { StorageState } from '#/graphql/generated/schemaTypes';
import { type ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { Telemetry } from '#/services/telemetry';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { removeItemFromShoppingListForMoveToPantry } from '#/apollo/utils/shoppingListCacheUpdaters';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';

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
  const [moveShoppingItemToPantry, { loading }] = useMutation(
    MoveShoppingItemToPantryDocument,
    {
      update: (cache, { data }) => {
        if (!data?.moveShoppingItemToPantry || !moveToPantryIdRef.current)
          return;

        executeCacheUpdate(() => {
          // Add to pantry items cache
          const addToPantryCache = createAddToParentConnectionUpdater(
            'Pantry',
            'itemsConnection',
            'PantryItem',
          );
          addToPantryCache(
            cache,
            moveToPantryIdRef.current!,
            data.moveShoppingItemToPantry!.pantryItem!,
          );

          const selectedItem = selectedItemRef.current;
          if (!selectedItem || !currentListId) return;

          if (removeFromListRef.current) {
            // Remove from shopping list cache if removeFromList was true
            const wasPurchased =
              selectedItem.purchaseInfo?.isPurchased ?? false;
            removeItemFromShoppingListForMoveToPantry(
              cache,
              currentListId,
              selectedItem.id,
              wasPurchased,
            );
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
                  purchaseInfo(existing: any) {
                    return { ...existing, isPurchased: false };
                  },
                  version(existingVersion = 0) {
                    return existingVersion + 1;
                  },
                  updatedAt() {
                    return new Date().toISOString();
                  },
                },
              });
            }
          }
        }, 'Cache update failed for moveShoppingItemToPantry:');
      },
      onCompleted: () => {
        onSuccess?.();
      },
      onError: error => {
        alertService.alert(
          'Error',
          error.message || 'Failed to move item to pantry',
        );
      },
    },
  );

  /**
   * Move a shopping list item to pantry
   */
  const moveToPantry = async (
    item: ShoppingListItemDisplayFragment,
    input: MoveToPantryInput,
  ) => {
    // Store refs for cache update
    selectedItemRef.current = item;
    moveToPantryIdRef.current = input.pantryId;
    removeFromListRef.current = input.removeFromList;

    const result = await executeMutation(
      () =>
        moveShoppingItemToPantry({
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
        }),
      'Failed to move item to pantry:',
    );
    if (!result) return false;

    Telemetry.trackEvent('shopping_item_moved_to_pantry', {
      shopping_list_id: currentListId,
      pantry_id: input.pantryId,
      remove_from_list: input.removeFromList,
    });

    return true;
  };

  return {
    moveToPantry,
    loading,
  };
}
