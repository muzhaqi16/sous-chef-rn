/**
 * Local-first: price tracking rides on updateShoppingList's `settings` sub-input —
 * an absolute set keyed by the list id, written to the cache before firing and
 * idempotent on a queued replay. The budget limit is saved with the rest of the
 * settings by useUpdateShoppingList.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { UpdateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseShoppingListBudget_ListFragmentDoc,
  type UseShoppingListBudget_ListFragment,
} from './useShoppingListBudget.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { toastService } from '#/services/toastService';
import { applyOptimisticFragmentPatch } from '#/apollo/utils/cacheUpdaters';
import type { UpdateShoppingListInput } from '#/graphql/generated/schemaTypes';

export function useShoppingListBudget() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [mutate] = useMutation(UpdateShoppingListDocument);

  const applyOptimistic = (
    id: string,
    patch: Partial<UseShoppingListBudget_ListFragment>,
    label: string,
  ): (() => void) =>
    applyOptimisticFragmentPatch(
      client.cache,
      { typename: 'ShoppingList', id },
      {
        fragment: UseShoppingListBudget_ListFragmentDoc,
        fragmentName: 'useShoppingListBudget_list',
      },
      patch,
      label,
    );

  const runUpdate = async (
    id: string,
    input: Omit<UpdateShoppingListInput, 'id' | 'version'>,
    revert: () => void,
    failureMessage: string,
  ): Promise<boolean> => {
    // The server requires the version: an update sent without one reports
    // success while overwriting a concurrent edit.
    const current =
      client.cache.readFragment<UseShoppingListBudget_ListFragment>({
        id: client.cache.identify({ __typename: 'ShoppingList', id }),
        fragment: UseShoppingListBudget_ListFragmentDoc,
        fragmentName: 'useShoppingListBudget_list',
      });
    if (!current) {
      revert();
      toastService.error(failureMessage);
      return false;
    }

    const settled = await settleMutation(
      () =>
        mutate({
          variables: { input: { id, ...input, version: current.version } },
          context: { localFirst: true },
        }),
      {
        document: UpdateShoppingListDocument,
        fallback: failureMessage,
        onFailed: revert,
      },
    );
    return settled.status !== 'failed';
  };

  const setPriceTracking = async (
    id: string,
    priceTracking: boolean,
  ): Promise<boolean> => {
    const revert = applyOptimistic(id, { priceTracking }, 'Set Price Tracking');
    return runUpdate(
      id,
      { settings: { priceTracking } },
      revert,
      t('shoppingListScreens.failedToSetPriceTracking'),
    );
  };

  return { setPriceTracking };
}
