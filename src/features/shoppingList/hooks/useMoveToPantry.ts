import { useApolloClient, useMutation } from '@apollo/client/react';
import { MoveShoppingItemToPantryDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type {
  PriceSource,
  ReceiptRefInput,
  StockAmountInput,
  StorageState,
} from '#/graphql/generated/schemaTypes';
import type { ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { Telemetry } from '#/services/telemetry';
import { errorService } from '#/services/errorService';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import {
  applyMoveToPantryCacheUpdate,
  revertLocalMove,
  writeLocalMove,
} from '#features/shoppingList/cache/localMove';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';
import { generateEntityId } from '#/utils/generateEntityId';
import { todayKey } from '#/utils/dateUtils';

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
}

export function useMoveToPantry({
  currentListId,
  onSuccess,
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
   * Move a shopping list item to the pantry (local-first) under a pantry row id
   * minted here as `input.pantryItemId`, so cache and server share one entity;
   * a permanent write, as the queue's null result tears down `optimisticResponse`.
   */
  const moveToPantry = async (
    item: ShoppingListItemDisplayFragment,
    input: MoveToPantryInput,
  ): Promise<boolean> => {
    const pantryItemId = generateEntityId();
    const moved = {
      pantryId: input.pantryId,
      pantryItemId,
      shoppingListItemId: item.id,
      removeFromList: input.removeFromList,
    };
    // A detail read on a client-minted id 404s and renders the deleted state;
    // `useIsCreateUnconfirmed` skips it until the server confirms.
    unconfirmedCreates.mark(pantryItemId);
    const written = writeLocalMove(client.cache, {
      item,
      pantryId: input.pantryId,
      pantryItemId,
      amount: input.amount,
      storageState: input.storageState,
      expiresOn: input.expiresOn,
      totalCost: input.totalCost,
      removeFromList: input.removeFromList,
      currentListId,
    });

    // Both sides were written, so both are undone. Counters another write moved
    // in the meantime cannot be restored exactly, so the lists re-read them.
    const revert = () => {
      try {
        if (!revertLocalMove(client.cache, moved, written)) {
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
      },
    );
    if (settled.status === 'failed') return false;

    // The id is the server's now, so the detail screen may query it.
    unconfirmedCreates.confirm(pantryItemId);

    Telemetry.trackEvent('shopping_item_moved_to_pantry', {
      shopping_list_id: currentListId,
      pantry_id: input.pantryId,
      remove_from_list: input.removeFromList,
    });

    return true;
  };

  return { moveToPantry };
}
