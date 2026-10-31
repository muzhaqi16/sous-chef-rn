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
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { localMoveRow } from '#features/shoppingList/cache/localMove';
import type { MoveToPantryInputs } from '#features/shoppingList/offline/localWrites';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
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
      onCompleted: () => {
        onSuccess?.();
      },
    },
  );

  const client = useApolloClient();
  const { t } = useTranslation();

  /**
   * Move a shopping list item to the pantry (local-first) under a pantry row id
   * minted here as `input.pantryItemId`, so cache and server share one entity.
   */
  const moveToPantry = async (
    item: ShoppingListItemDisplayFragment,
    input: MoveToPantryInput,
  ): Promise<boolean> => {
    const pantryItemId = generateEntityId();
    // A detail read on a client-minted id 404s and renders the deleted state;
    // `useIsCreateUnconfirmed` skips it until the server confirms.
    unconfirmedCreates.mark(pantryItemId);
    const inputs: MoveToPantryInputs = {
      row: localMoveRow({ item, ...input }),
      listId: currentListId,
      now: new Date().toISOString(),
    };

    // Read when the user acts. A queued replay re-dates only the top-level
    // `$today` (`prepareReplay`); `input.today` keeps this day, so a default
    // expiry counts from the day of the move, not the day it syncs.
    const today = todayKey();
    const settled = await pendingWritesOf(client.cache).send(
      MoveShoppingItemToPantryDocument,
      {
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
      write =>
        settleMutation(() => moveShoppingItemToPantry(write), {
          document: MoveShoppingItemToPantryDocument,
          fallback: t('errors.moveToPantryFailedRetry'),
        }),
      inputs,
    );
    // Released on every outcome; a queued move is tracked by the offline
    // queue's pending set from here on.
    unconfirmedCreates.confirm(pantryItemId);
    if (settled.status === 'failed') return false;

    Telemetry.trackEvent('shopping_item_moved_to_pantry', {
      shopping_list_id: currentListId,
      pantry_id: input.pantryId,
      remove_from_list: input.removeFromList,
    });

    return true;
  };

  return { moveToPantry };
}
