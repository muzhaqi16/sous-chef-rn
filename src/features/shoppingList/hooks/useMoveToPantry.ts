import type { ApolloCache } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { MoveShoppingItemToPantryDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { UseMoveToPantry_WasPurchasedFragmentDoc } from './useMoveToPantry.generated';
import type {
  PriceSource,
  ReceiptRefInput,
  StockAmountInput,
  StorageState,
} from '#/graphql/generated/schemaTypes';
import { AcquisitionMethod } from '#/graphql/generated/schemaTypes';
import { localQuantity } from '#domain/stockAmount';
import { unitPriceFromTotal } from '#domain/purchasePrice';
import type { ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { Telemetry } from '#/services/telemetry';
import { errorService } from '#/services/errorService';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import {
  addToPantryItemsCache,
  adjustPantryItemCount,
  reconcileCreatedPantryItem,
  removeFromPantryItemsCache,
  type PantryItemRef,
} from '#features/pantry/cache/items';
import type { ListCounterChange } from '#features/shoppingList/cache/connections';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import {
  removeItemFromShoppingListForMoveToPantry,
  restoreItemToShoppingListAfterMoveToPantry,
  stampItemKeptOnListAfterMoveToPantry,
  unstampItemKeptOnListAfterMoveToPantry,
  type KeptOnListStamp,
} from '#features/shoppingList/cache/moveToPantry';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';
import { generateEntityId } from '#/utils/generateEntityId';
import { todayKey } from '#/utils/dateUtils';
import {
  evictLocalPantryItemSeeds,
  writeLocalPantryItem,
} from '#features/pantry/cache/writeLocalPantryItem';

export interface MoveToPantryInput {
  pantryId: string;
  /** What was bought, as stated: the server does any package arithmetic. */
  amount: StockAmountInput;
  storageState?: StorageState;
  /** YYYY-MM-DD. */
  expiresOn?: string;
  removeFromList: boolean;
  /** The total paid; the server records it exactly and derives the unit price. */
  totalCost?: number;
  notes?: string;
  /** The receipt it was bought on; its day and store go on the purchase and price. */
  receipt?: ReceiptRefInput;
  priceSource?: PriceSource;
}

interface UseMoveToPantryOptions {
  currentListId: string | undefined;
  onSuccess?: () => void;
  /** `'none'` leaves telling the user about a refusal to the caller, via `reason`. */
  present?: 'alert' | 'none';
}

/** What became of a move: applied or queued, or refused with the reason the user is told. */
export type MoveToPantryOutcome =
  | { status: 'moved' }
  | { status: 'rejected'; reason: string };

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
    cache.readFragment({
      id: itemCacheId,
      fragment: UseMoveToPantry_WasPurchasedFragmentDoc,
    })?.purchaseInfo.isPurchased ?? false
  );
}

/**
 * Cache side of a move-to-pantry: reconcile the returned `PantryItem` with the
 * row written under the minted id, then drop the shopping-list row or mark it
 * purchased and stamped.
 * Kept at module level because its value blocks (`?.`/`??`/ternary) would bail
 * the whole hook out of the React Compiler from inside the caller's try body.
 */
function applyMoveToPantryCacheUpdate(
  cache: ApolloCache,
  args: {
    pantryId: string;
    shoppingListItemId: string;
    removeFromList: boolean | null | undefined;
    currentListId: string | undefined;
    pantryItem: PantryItemRef;
    /** The id the move minted for the row it wrote. */
    clientId: string | null | undefined;
  },
): void {
  const { pantryId, shoppingListItemId, removeFromList, currentListId } = args;

  // A restock answers with the EXISTING row's id: the row written under the
  // minted id goes, and the restocked fields normalize onto the existing one.
  reconcileCreatedPantryItem(cache, pantryId, args.pantryItem, args.clientId);

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
    // Kept on the list: the purchase stamp was written before the move fired;
    // this is the server's own bump of the line.
    const cacheId = cache.identify({
      __typename: 'ShoppingListItem',
      id: shoppingListItemId,
    });
    if (cacheId) {
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
  present = 'alert',
}: UseMoveToPantryOptions) {
  const [moveShoppingItemToPantry] = useMutation(
    MoveShoppingItemToPantryDocument,
    {
      context: { localFirst: true },
      // Read the move target off the mutation's variables (never a shared ref)
      // so overlapping moves can't corrupt the wrong item; purchase status is
      // read from cache to pick the right filtered variant to remove from.
      update: (cache, { data }, { variables }) => {
        const payload = appliedPayload(data);
        const input = variables?.input;
        if (!payload || !input) return;
        const { pantryId, shoppingListItemId, removeFromList } = input;

        try {
          applyMoveToPantryCacheUpdate(cache, {
            pantryId,
            shoppingListItemId,
            removeFromList,
            currentListId,
            pantryItem: payload.pantryItem,
            clientId: input.pantryItemId,
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
    },
  );

  const client = useApolloClient();
  const { t } = useTranslation();

  /**
   * Move a shopping list item to the pantry (local-first). The pantry row's id is
   * minted here and sent as `input.pantryItemId`, so the cached row and the
   * server's are the SAME entity. A permanent write, never `optimisticResponse`:
   * the queue completes a queued mutation with null and would tear that down.
   */
  const moveToPantry = async (
    item: ShoppingListItemDisplayFragment,
    input: MoveToPantryInput,
  ): Promise<MoveToPantryOutcome> => {
    const pantryItemId = generateEntityId();

    // Built before the try: `?.`/`??` are value blocks, and the React Compiler
    // bails out of the whole hook when one appears inside a try body.
    const { measured } = input.amount;
    const localRow = {
      pantryId: input.pantryId,
      itemName: item.itemName ?? '',
      quantity: localQuantity(input.amount, item),
      itemId: item.item?.id,
      // The API tracks the stack in the stated unit, else the line's own.
      unitId: measured?.unitId ?? item.unit?.id,
      storageState: input.storageState,
      expiresOn: input.expiresOn,
      acquisitionMethod: AcquisitionMethod.ShoppingList,
      costPerUnit: measured
        ? unitPriceFromTotal(input.totalCost ?? null, measured.quantity)
        : null,
    };

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
    const keepOnListId = input.removeFromList ? undefined : currentListId;
    let counterChange: ListCounterChange | undefined;
    let keptStamp: KeptOnListStamp | undefined;
    try {
      // A detail read on a client-minted id 404s and renders the deleted
      // state; `useIsCreateUnconfirmed` skips it until the server confirms.
      unconfirmedCreates.mark(pantryItemId);
      writeLocalPantryItem(client.cache, pantryItemId, localRow);
      addToPantryItemsCache(client.cache, input.pantryId, {
        __typename: 'PantryItem',
        id: pantryItemId,
      });
      // The count travels with the row: offline the mutation's `update` never
      // runs, and `usePantryScreen` branches on this value to pick server vs
      // client sorting, so a stale one selects the wrong mode too.
      adjustPantryItemCount(client.cache, input.pantryId, 1);
      if (unlinkFromListId) {
        counterChange = removeItemFromShoppingListForMoveToPantry(
          client.cache,
          unlinkFromListId,
          item.id,
          wasPurchased,
          { evictEntity: false },
        );
      }
      if (keepOnListId) {
        keptStamp = stampItemKeptOnListAfterMoveToPantry(
          client.cache,
          keepOnListId,
          item.id,
          wasPurchased,
        );
      }
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Move Item to Pantry (optimistic)',
      });
    }

    // Both sides were written, so both are undone. The shopping row was
    // unlinked rather than evicted, so the entity is still here to re-link.
    const revert = () => {
      try {
        // Evicted, not only unlinked: a cached row persists and a detail read finds it.
        removeFromPantryItemsCache(client.cache, input.pantryId, pantryItemId, {
          evictItem: true,
        });
        adjustPantryItemCount(client.cache, input.pantryId, -1);
        evictLocalPantryItemSeeds(client.cache, pantryItemId);
        let exact = true;
        if (input.removeFromList) {
          exact = restoreItemToShoppingListAfterMoveToPantry(
            client.cache,
            item.id,
            counterChange,
          );
        }
        if (keptStamp) {
          exact = unstampItemKeptOnListAfterMoveToPantry(
            client.cache,
            keptStamp,
          );
        }
        // Counters another write moved in the meantime cannot be restored
        // exactly, so the lists re-read them.
        if (!exact) {
          client.refetchQueries({ include: 'active' }).catch(error => {
            errorService.reportError(error, {
              operation: 'Re-read after a refused move to pantry',
            });
          });
        }
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected move to pantry',
        });
      }
      unconfirmedCreates.confirm(pantryItemId);
    };

    // Read when the user acts. A queued replay re-dates only the top-level
    // `$today` (`prepareReplay`); `input.today` keeps this day, so a default
    // expiry counts from the day of the move, not the day it syncs.
    const today = todayKey();
    const settled = await settleMutation(
      () =>
        moveShoppingItemToPantry({
          variables: {
            today,
            input: {
              shoppingListItemId: item.id,
              pantryId: input.pantryId,
              pantryItemId,
              idempotencyKey: generateEntityId(),
              amount: input.amount,
              storageState: input.storageState,
              expiresOn: input.expiresOn,
              today,
              removeFromList: input.removeFromList,
              totalCost: input.totalCost,
              notes: input.notes,
              receipt: input.receipt,
              priceSource: input.priceSource,
            },
          },
        }),
      {
        document: MoveShoppingItemToPantryDocument,
        fallback: t('errors.moveToPantryFailedRetry'),
        onFailed: revert,
        present,
      },
    );
    if (settled.status === 'failed') {
      return {
        status: 'rejected',
        reason: settled.failure?.body ?? t('errors.moveToPantryFailedRetry'),
      };
    }

    // The id is the server's now, so the detail screen may query it.
    unconfirmedCreates.confirm(pantryItemId);

    Telemetry.trackEvent('shopping_item_moved_to_pantry', {
      shopping_list_id: currentListId,
      pantry_id: input.pantryId,
      remove_from_list: input.removeFromList,
    });

    return { status: 'moved' };
  };

  return { moveToPantry };
}
