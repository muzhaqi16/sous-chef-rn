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
import { useWrite } from '#/apollo/write/useWrite';
import {
  addToPantryItemsCache,
  removeFromPantryItemsCache,
} from '#/apollo/utils/pantryCacheUpdaters';
import { removeItemFromShoppingListForMoveToPantry } from '#/apollo/utils/shoppingListCacheUpdaters';
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
  const { describe } = useWrite();

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

    // ONLY the pantry side is written eagerly. Removing the shopping row here
    // too would be lossy: when a REPLAY fails (not the initial call), the queue
    // withdraws the entity it created — the PantryItem — but nothing restores a
    // shopping row this hook removed, so the item would vanish from both lists.
    // Observed on device: a move whose first attempt timed out, retried, and
    // came back NotFound left the row in neither place. The shopping side stays
    // with the mutation's `update` callback, which runs only on a real payload.
    try {
      addToPantryItemsCache(client.cache, input.pantryId, optimisticPantryItem);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Move Item to Pantry (optimistic)',
      });
    }

    // The builder above wrote the complete entity — completeness against every
    // query that reads a PantryItem is its business, not the kit's — so this
    // RECORDS the create rather than performing it. What it buys is the undo:
    // a replay refused after a restart is withdrawn from the persisted intent,
    // which takes the row out of the pantry's connection instead of leaving a
    // bare evict behind. `reindex` states no membership because a create is
    // inserted by the builder; the spec exists for the undo's sake.
    const { context } = describe({
      target: { __typename: 'PantryItem', id: pantryItemId },
      lifecycle: 'create',
      patch: {},
      reindex: {
        parent: { __typename: 'Pantry', id: input.pantryId },
        field: 'itemsConnection',
        decidableFilters: [],
        after: {},
        before: {},
      },
      // The move carries the quantities the person confirmed at the shelf, so
      // a conflict re-sends them rather than discarding the move.
      convergence: 'absolute',
    });

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
        context,
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Failed to move item to pantry:',
      });
    }

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      // Only the pantry row needs undoing — the shopping row was never touched.
      try {
        removeFromPantryItemsCache(client.cache, input.pantryId, pantryItemId);
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
