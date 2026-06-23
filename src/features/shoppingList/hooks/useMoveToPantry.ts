import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { handleMutationError } from '#/utils/errorHandlers';
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

/** Minimal read of the moved item's purchase status, to pick the right
 *  filtered connection variant to remove it from. */
const MoveToPantryItemPurchaseFragment = gql`
  fragment _MoveToPantryItemPurchase on ShoppingListItem {
    id
    purchaseInfo {
      isPurchased
    }
  }
`;

/**
 * Hook for moving shopping list items to pantry
 * Handles mutation, cache updates, and optimistic UI updates
 */
export function useMoveToPantry({
  currentListId,
  onSuccess,
}: UseMoveToPantryOptions) {
  // Move to pantry mutation with smart cache updates
  const [moveShoppingItemToPantry, { loading }] = useMutation(
    MoveShoppingItemToPantryDocument,
    {
      // Read the move target off the mutation's variables (never a shared ref)
      // so overlapping moves can't corrupt the wrong item; purchase status is
      // read from cache to pick the right filtered variant to remove from.
      update: (cache, { data }, { variables }) => {
        const payload = data?.moveShoppingItemToPantry;
        const input = variables?.input;
        if (
          payload?.__typename !== 'MoveShoppingItemToPantryPayload' ||
          !input
        ) {
          return;
        }
        const { pantryId, shoppingListItemId, removeFromList } = input;

        executeCacheUpdate(() => {
          // Add the returned PantryItem to the pantry's items connection. When
          // the item already existed in the pantry, the server returns that
          // existing entry restocked (combined quantity, extra batch) rather
          // than a new row — so the returned id may already be in the
          // connection. The updater's default checkDuplicates guard skips
          // re-inserting that edge, and Apollo normalizes the restock-mutated
          // fields (quantity, activeBatchCount, …) onto the existing entity by
          // id. Keep checkDuplicates on — without it a restock would duplicate
          // the edge.
          const addToPantryCache = createAddToParentConnectionUpdater(
            'Pantry',
            'itemsConnection',
            'PantryItem',
          );
          addToPantryCache(cache, pantryId, payload.pantryItem);

          if (!currentListId) return;

          if (removeFromList) {
            const itemCacheId = cache.identify({
              __typename: 'ShoppingListItem',
              id: shoppingListItemId,
            });
            const wasPurchased = itemCacheId
              ? cache.readFragment<{
                  purchaseInfo?: { isPurchased?: boolean } | null;
                }>({
                  id: itemCacheId,
                  fragment: MoveToPantryItemPurchaseFragment,
                })?.purchaseInfo?.isPurchased ?? false
              : false;
            removeItemFromShoppingListForMoveToPantry(
              cache,
              currentListId,
              shoppingListItemId,
              wasPurchased,
            );
          } else {
            // If keeping in list, mark as unpurchased in cache (server does this automatically)
            const cacheId = cache.identify({
              __typename: 'ShoppingListItem',
              id: shoppingListItemId,
            });
            if (cacheId) {
              cache.modify<ShoppingListItemDisplayFragment>({
                id: cacheId,
                fields: {
                  purchaseInfo(existing) {
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
        handleMutationError(error, { operation: 'Move Item to Pantry' });
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
