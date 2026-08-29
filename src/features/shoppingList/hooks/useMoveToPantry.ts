import { gql, type ApolloCache } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { handleMutationError } from '#/utils/errorHandlers';
import { MoveShoppingItemToPantryDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { StorageState } from '#/graphql/generated/schemaTypes';
import { type ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { Telemetry } from '#/services/telemetry';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { errorService } from '#/services/errorService';
import { buildOptimisticPantryItem } from '#features/pantry/hooks/buildOptimisticPantryItem';
import {
  addToPantryItemsCache,
  adjustPantryItemCount,
  removeFromPantryItemsCache,
} from '#/apollo/utils/pantryCacheUpdaters';
import {
  removeItemFromShoppingListForMoveToPantry,
  restoreItemToShoppingListAfterMoveToPantry,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { generateEntityId } from '#/utils/generateEntityId';

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
 * Which filtered variant of the list's connection the row sits in. Both the
 * eager removal and the mutation's `update` have to agree on this, or the
 * removal lands on the wrong tab and its `totalCount` decrements the wrong one.
 */
function readWasPurchased(cache: ApolloCache, itemId: string): boolean {
  const itemCacheId = cache.identify({
    __typename: 'ShoppingListItem',
    id: itemId,
  });
  if (!itemCacheId) return false;
  return (
    cache.readFragment<{
      purchaseInfo?: { isPurchased?: boolean } | null;
    }>({
      id: itemCacheId,
      fragment: MoveToPantryItemPurchaseFragment,
    })?.purchaseInfo?.isPurchased ?? false
  );
}

/**
 * Hook for moving shopping list items to pantry
 * Handles mutation, cache updates, and optimistic UI updates
 */
/**
 * Cache side of a move-to-pantry: add the returned `PantryItem` to the pantry's
 * items connection, then either drop the shopping-list row or mark it
 * unpurchased.
 *
 * Module-level rather than inlined into the mutation's `update` because its
 * body is full of `?.` / `??` / ternaries, and the React Compiler bails out of
 * the entire hook when a value block appears inside a try/catch. Keeping it
 * here leaves the caller's try body a single plain call.
 * See scripts/probe-compiler-try-forms.mjs.
 */
function applyMoveToPantryCacheUpdate(
  cache: ApolloCache,
  args: {
    pantryId: string;
    shoppingListItemId: string;
    removeFromList: boolean | null | undefined;
    currentListId: string | undefined;
    pantryItem: { id: string };
  },
): void {
  const { pantryId, shoppingListItemId, removeFromList, currentListId } = args;

  // Add the returned PantryItem to the pantry's items connection. When the item
  // already existed in the pantry, the server returns that existing entry
  // restocked (combined quantity, extra batch) rather than a new row — so the
  // returned id may already be in the connection. The updater's default
  // checkDuplicates guard skips re-inserting that edge, and Apollo normalizes
  // the restock-mutated fields (quantity, activeBatchCount, …) onto the existing
  // entity by id. Keep checkDuplicates on — without it a restock would duplicate
  // the edge.
  const addToPantryCache = createAddToParentConnectionUpdater(
    'Pantry',
    'itemsConnection',
    'PantryItem',
  );
  addToPantryCache(cache, pantryId, args.pantryItem);

  if (!currentListId) return;

  if (removeFromList) {
    // Idempotent with the eager unlink: filtering an edge that is already gone
    // leaves the connection untouched. The evict is the part only the confirmed
    // path may do — offline the entity has to survive for the withdrawal.
    removeItemFromShoppingListForMoveToPantry(
      cache,
      currentListId,
      shoppingListItemId,
      readWasPurchased(cache, shoppingListItemId),
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
}

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

        try {
          applyMoveToPantryCacheUpdate(cache, {
            pantryId,
            shoppingListItemId,
            removeFromList,
            currentListId,
            pantryItem: payload.pantryItem,
          });
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Cache update failed for moveShoppingItemToPantry:',
          });
        }
      },
      onCompleted: () => {
        onSuccess?.();
      },
      onError: error => {
        handleMutationError(error, { operation: 'Move Item to Pantry' });
      },
    },
  );

  const client = useApolloClient();

  /**
   * Move a shopping list item to the pantry (local-first).
   *
   * The pantry row's id is minted here and sent as `input.pantryItemId`, so the
   * row written to the cache before firing and the row the server writes are the
   * SAME entity — which is what lets the move happen with no network. The write
   * is permanent rather than an `optimisticResponse`, because the offline queue
   * completes a queued mutation with a null result and Apollo would tear an
   * optimistic layer down at that moment.
   *
   * **The minted id is honoured only on the CREATE branch.** If the target
   * pantry already holds an active stack of the same catalog item, the server
   * restocks that stack and the payload comes back carrying that EXISTING row's
   * id instead. The client cannot always predict which branch it will get — its
   * pantry cache can be stale — so it reconciles on the response: a returned id
   * that differs from the minted one means the optimistic row was never real,
   * and it is evicted before the server's row is added.
   */
  const moveToPantry = async (
    item: ShoppingListItemDisplayFragment,
    input: MoveToPantryInput,
  ) => {
    const pantryItemId = generateEntityId();

    // Built before the try: `?.`/`??` are value blocks, and the React Compiler
    // bails out of the whole hook when one appears inside a try body.
    const optimisticPantryItem = buildOptimisticPantryItem(
      pantryItemId,
      {
        pantryId: input.pantryId,
        itemName: item.itemName ?? '',
        quantity: input.actualQuantity,
        itemId: item.item?.id,
        unitId: input.actualUnitId,
        storageState: input.storageState,
        expiresAt: input.expiresAt,
      },
      client.cache,
    );

    // BOTH sides are written eagerly, because offline neither the mutation's
    // `update` callback nor the replay runs one: the queue completes a queued
    // mutation with a null result, and `executeMutation` replays with no
    // `update` at all. Leaving the shopping side to that callback meant the
    // server deleted the row while the client kept rendering it in the list and
    // in both counters until a full refetch.
    //
    // The eager removal UNLINKS without evicting. That distinction is what makes
    // it safe: the earlier version of this hook evicted, so when a REPLAY failed
    // (not the initial call) the queue withdrew the PantryItem it created and
    // nothing could restore the shopping row — observed on device, a move that
    // timed out, retried, and came back NotFound left the item in neither place.
    // The entity survives here, and `handleQueueFailure` re-links it through
    // `restoreItemToShoppingListAfterMoveToPantry`.
    const wasPurchased = readWasPurchased(client.cache, item.id);
    // Resolved BEFORE the try: `&&` is a value block, and the React Compiler
    // bails out of the whole hook when one appears inside a try body.
    const unlinkFromListId = input.removeFromList ? currentListId : undefined;
    try {
      addToPantryItemsCache(client.cache, input.pantryId, optimisticPantryItem);
      // The count travels with the row. Offline the mutation's `update` never
      // runs, so nothing else corrects it and the pantry header would keep
      // reporting the pre-move total over the rows the user can see.
      // `usePantryScreen` also branches on this value to pick server vs client
      // sorting, so a stale one can select the wrong mode as well.
      adjustPantryItemCount(client.cache, input.pantryId, 1);
      if (unlinkFromListId) {
        removeItemFromShoppingListForMoveToPantry(
          client.cache,
          unlinkFromListId,
          item.id,
          wasPurchased,
          { evictEntity: false },
        );
      }
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Move Item to Pantry (optimistic)',
      });
    }

    let result;
    try {
      result = await moveShoppingItemToPantry({
        variables: {
          input: {
            shoppingListItemId: item.id,
            pantryId: input.pantryId,
            pantryItemId,
            idempotencyKey: generateEntityId(),
            actualQuantity: input.actualQuantity,
            actualUnitId: input.actualUnitId,
            storageState: input.storageState,
            expiresAt: input.expiresAt,
            removeFromList: input.removeFromList,
            actualPrice: input.actualPrice,
            notes: input.notes,
          },
        },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Failed to move item to pantry:',
      });
    }

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      // Both sides were written, so both are undone. The shopping row was
      // unlinked rather than evicted, so the entity is still here to re-link.
      try {
        removeFromPantryItemsCache(client.cache, input.pantryId, pantryItemId);
        adjustPantryItemCount(client.cache, input.pantryId, -1);
        if (input.removeFromList) {
          restoreItemToShoppingListAfterMoveToPantry(client.cache, item.id);
        }
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected move to pantry',
        });
      }
      if (result?.error) {
        errorService.reportError(result.error, {
          operation: 'Failed to move item to pantry:',
        });
      }
      return false;
    }

    // The server may have restocked an existing stack instead of creating the
    // row we minted. Its payload then carries that row's id, and our optimistic
    // entity is a ghost — evict it so the pantry does not show the item twice.
    // The mutation's `update` callback adds the server's row.
    const payload = result?.data?.moveShoppingItemToPantry;
    const serverId =
      payload?.__typename === 'MoveShoppingItemToPantryPayload'
        ? payload.pantryItem.id
        : undefined;
    if (serverId && serverId !== pantryItemId) {
      try {
        removeFromPantryItemsCache(client.cache, input.pantryId, pantryItemId);
        adjustPantryItemCount(client.cache, input.pantryId, -1);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Evict superseded optimistic pantry row',
        });
      }
    }

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
