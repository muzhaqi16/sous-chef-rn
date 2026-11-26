/**
 * Local-first: price tracking rides on updateShoppingList's `settings` sub-input —
 * an absolute set keyed by the list id, written to the cache before firing and
 * idempotent on a queued replay. The budget limit is saved with the rest of the
 * settings by useUpdateShoppingList.
 */

import { useApolloClient } from '@apollo/client/react';
import { useTranslation } from '#i18n';
import {
  UseShoppingListBudget_ListFragmentDoc,
  type UseShoppingListBudget_ListFragment,
} from './useShoppingListBudget.generated';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { toastService } from '#services/toastService';
import type { UpdateShoppingListInput } from '#graphql/generated/schemaTypes';
import { updateShoppingListWrite } from '#features/shoppingList/offline/localWrites';

export function useShoppingListBudget() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const update = useLocalWrite(updateShoppingListWrite, {
    fallback: t('shoppingListScreens.failedToSetPriceTracking'),
  });

  const runUpdate = async (
    id: string,
    input: Omit<UpdateShoppingListInput, 'id' | 'version'>,
    patch: Partial<UseShoppingListBudget_ListFragment>,
    failureMessage: string,
  ): Promise<boolean> => {
    // The server requires the version: an update sent without one reports
    // success while overwriting a concurrent edit.
    const current =
      client.cache.readFragment<UseShoppingListBudget_ListFragment>({
        id: client.cache.identify({ __typename: 'ShoppingList', id }),
        fragment: UseShoppingListBudget_ListFragmentDoc,
        fragmentName: 'useShoppingListBudget_list',
        optimistic: true,
      });
    if (!current) {
      toastService.error(failureMessage);
      return false;
    }

    const settled = await update.send(
      { input: { id, ...input, version: current.version } },
      { entity: { __typename: 'ShoppingList', id }, fields: patch },
      { settle: { fallback: failureMessage } },
    );
    return settled.status !== 'failed';
  };

  const setPriceTracking = (
    id: string,
    priceTracking: boolean,
  ): Promise<boolean> =>
    runUpdate(
      id,
      { settings: { priceTracking } },
      { priceTracking },
      t('shoppingListScreens.failedToSetPriceTracking'),
    );

  return { setPriceTracking };
}
