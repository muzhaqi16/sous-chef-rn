/**
 * Removal only. Edits go through `useUpdatePantryItem`; adds go through
 * `AddToPantrySheet` / `usePantryItemSubmission`, which own the
 * DuplicatePantryItemError restock/force-add recovery every add path requires.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { DeletePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import type { RemoveItemInputs } from '#features/pantry/offline/localWrites';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { todayKey } from '#/utils/dateUtils';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { useTranslation } from '#/i18n';

interface UsePantryItemMutationsOptions {
  pantryId: string | undefined;
}

export function usePantryItemMutations({
  pantryId,
}: UsePantryItemMutationsOptions) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [removeItemMutation] = useMutation(DeletePantryItemDocument, {
    context: { localFirst: true },
  });

  /** @returns whether the item is gone — false when the server refused it. */
  const removeItem = async (itemId: string): Promise<boolean> => {
    if (!pantryId) {
      return false;
    }

    // Register pending delete to handle subscription race condition
    subscriptionService.registerPendingDelete(
      itemId,
      pantryId,
      'PantryItem',
      'Pantry',
      'itemsConnection',
    );

    const inputs: RemoveItemInputs = { pantryId };
    const settled = await pendingWritesOf(client.cache).send(
      DeletePantryItemDocument,
      { input: { id: itemId }, today: todayKey() },
      write =>
        settleMutation(() => removeItemMutation(write), {
          document: DeletePantryItemDocument,
          fallback: t('errors.deleteItemFailed'),
          removal: true,
        }),
      inputs,
    );
    subscriptionService.unregisterPendingDelete(itemId);
    return settled.status !== 'failed';
  };

  return { removeItem };
}
