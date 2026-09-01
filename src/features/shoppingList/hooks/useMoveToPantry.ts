import { gql, type ApolloCache } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { handleMutationError } from '#/utils/errorHandlers';
import { MoveShoppingItemToPantryDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  AcquisitionMethod,
  StorageState,
} from '#/graphql/generated/schemaTypes';
import { type ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { Telemetry } from '#/services/telemetry';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { errorService } from '#/services/errorService';
import { buildOptimisticPantryItem } from '#features/pantry/hooks/buildOptimisticPantryItem';
import { writePantryItemDetailStub } from '#features/pantry/hooks/writePantryItemDetailStub';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import {
  addToPantryItemsCache,
  adjustPantryItemCount,
  removeFromPantryItemsCache,
  evictPantryItemDetailStub,
} from '#/apollo/utils/pantryCacheUpdaters';
import {
  removeItemFromShoppingListForMoveToPantry,
  restoreItemToShoppingListAfterMoveToPantry,
  writePurchaseInfo,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t as tGlobal } from '#/i18n';
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
 * Cache side of a move-to-pantry: add the returned `PantryItem` to the pantry's
 * connection, then drop the shopping-list row or mark it unpurchased. Kept at
 * module level because its value blocks (`?.`/`??`/ternary) would bail the whole
 * hook out of the React Compiler from inside the caller's try body.
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

  // The server may return an EXISTING row restocked rather than a new one, so the
  // returned id can already be in the connection. Keep the updater's default
  // checkDuplicates on — without it a restock duplicates the edge; Apollo
  // normalizes the restocked fields onto the existing entity by id.
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
    // Kept in the list: the server marks it unpurchased, so mirror that here.
    const cacheId = cache.identify({
      __typename: 'ShoppingListItem',
      id: shoppingListItemId,
    });
    if (cacheId) {
      // The purchase record goes through its own writer: it owns the rule that
      // a flag flip clears the stocked stamp, which a spread here would keep.
      writePurchaseInfo(cache, shoppingListItemId, { isPurchased: false });
      cache.modify<ShoppingListItemDisplayFragment>({
        id: cacheId,
        fields: {
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
   * Move a shopping list item to the pantry (local-first). The pantry row's id is
   * minted here and sent as `input.pantryItemId`, so the cached row and the
   * server's are the SAME entity. A permanent write, never `optimisticResponse`:
   * the queue completes a queued mutation with null and would tear that down.
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

    // BOTH sides are written eagerly: offline neither the mutation's `update` nor
    // the replay runs one (the queue completes with a null result, and
    // `executeMutation` replays with no `update`). The removal UNLINKS without
    // evicting, so a failed replay can re-link the surviving entity via
    // `restoreItemToShoppingListAfterMoveToPantry`; an evict would leave the item
    // in neither place.
    const wasPurchased = readWasPurchased(client.cache, item.id);
    // Resolved BEFORE the try: `&&` is a value block, and the React Compiler
    // bails out of the whole hook when one appears inside a try body.
    const unlinkFromListId = input.removeFromList ? currentListId : undefined;
    // Same reason. `actualPrice` is per unit, so the stub's own
    // `costPerUnit x quantity` reproduces what the server will compute.
    const detailStubFields = {
      itemId: item.item?.id,
      itemName: item.itemName ?? '',
      acquisitionMethod: AcquisitionMethod.ShoppingList,
      costPerUnit: input.actualPrice ?? null,
      quantity: input.actualQuantity,
    };
    try {
      // A detail read on a client-minted id 404s and renders the deleted
      // state; `useIsCreateUnconfirmed` skips it until the server confirms.
      unconfirmedCreates.mark(pantryItemId);
      addToPantryItemsCache(client.cache, input.pantryId, optimisticPantryItem);
      // Detail-shape the row so the moved item's detail screen renders its
      // costs from cache — offline this local write is the only source.
      writePantryItemDetailStub(client.cache, pantryItemId, detailStubFields);
      // The count travels with the row: offline the mutation's `update` never
      // runs, and `usePantryScreen` branches on this value to pick server vs
      // client sorting, so a stale one selects the wrong mode too.
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
        evictPantryItemDetailStub(client.cache, pantryItemId);
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
      // A refusal resolves with HTTP 200 and no `error`, so nothing else tells
      // the shopper: the row simply reappears on the list. Reachable now that a
      // target whose unit changed mid-move comes back as a retryable conflict.
      unconfirmedCreates.confirm(pantryItemId);
      alertRejectedMutation(result, tGlobal('errors.moveToPantryFailedRetry'));
      return false;
    }

    // The minted id is honoured only on the CREATE branch: a restock returns the
    // EXISTING row's id, which makes the locally written entity a ghost. Evict it
    // so the pantry does not show the item twice; `update` adds the server's row.
    const payload = result?.data?.moveShoppingItemToPantry;
    const serverId =
      payload?.__typename === 'MoveShoppingItemToPantryPayload'
        ? payload.pantryItem.id
        : undefined;
    if (serverId && serverId !== pantryItemId) {
      try {
        removeFromPantryItemsCache(client.cache, input.pantryId, pantryItemId);
        adjustPantryItemCount(client.cache, input.pantryId, -1);
        // The stub's writes survive evicting the row, and persist.
        evictPantryItemDetailStub(client.cache, pantryItemId);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Evict superseded optimistic pantry row',
        });
      }
    }

    // The id is the server's now, so the detail screen may query it.
    unconfirmedCreates.confirm(pantryItemId);

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
