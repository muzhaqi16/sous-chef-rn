import { useFragment, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { useUser } from '#store/useAppStore';
import { useDataState } from '#hooks/data/useDataState';
import { toastService } from '#/services/toastService';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { useUpdateShoppingList } from '#features/shoppingList/hooks/mutations/useUpdateShoppingList';
import { useShoppingListBudget } from '#features/shoppingList/hooks/mutations/useShoppingListBudget';
import { listOwnershipOf } from '#features/shoppingList/utils/ownershipHelpers';
import { useShoppingListPermissions } from '#features/shoppingList/hooks/useShoppingListPermissions';
import { useListCostToGo } from '#features/shoppingList/hooks/useListCostToGo';
import {
  ListBudgetDocument,
  UseListBudget_ListFragmentDoc,
} from './useListBudget.generated';

/** What finishing the budget field did: `invalid` is reported on the field. */
export type BudgetSaveOutcome = 'saved' | 'unchanged' | 'invalid';

/** A typed limit as the API takes it: empty clears it, a non-number is NaN. */
const budgetOf = (input: string): number | null =>
  input.trim() === '' ? null : parseDecimalInput(input);

/**
 * A list's money for Budget & prices, read from the cache so it shows offline,
 * and the writes the screen's controls make, each saving itself local-first.
 */
export function useListBudget(listId: string) {
  const { t } = useTranslation();
  const user = useUser();
  const { loading, error, refetch } = useQuery(ListBudgetDocument, {
    variables: { id: listId },
    fetchPolicy: 'cache-first',
  });
  const read = useFragment({
    fragment: UseListBudget_ListFragmentDoc,
    fragmentName: 'useListBudget_list',
    from: { __typename: 'ShoppingList', id: listId },
  });
  const list = read.complete ? read.data : null;

  const costToGo = useListCostToGo(listId);

  const isOwner =
    listOwnershipOf(
      listId,
      list ? { ownerships: list.ownerships } : null,
      user?.id,
    ) === 'owner';
  const permissions = useShoppingListPermissions(list, user?.id);
  const state = useDataState({
    loading,
    error,
    hasResult: !!list,
    isEmpty: false,
  });

  const { updateShoppingList } = useUpdateShoppingList(
    t('errors.saveSettingsFailed'),
  );
  const { setPriceTracking } = useShoppingListBudget();
  const reportFailure = () => {
    toastService.error(t('errors.saveSettingsFailed'));
  };

  const saveBudget = (input: string): BudgetSaveOutcome => {
    const amount = budgetOf(input);
    if (amount !== null && (Number.isNaN(amount) || amount < 0)) {
      return 'invalid';
    }
    if (!list || amount === list.budgetAmount) return 'unchanged';
    const planning = list.currency
      ? { budgetAmount: amount, currency: list.currency }
      : { budgetAmount: amount };
    updateShoppingList(listId, { planning }).catch(reportFailure);
    return 'saved';
  };

  // The savings on screen come back in the same answer as the store.
  const pickStore = (store: { id: string; name: string } | null) => {
    if (store?.id === list?.targetStore?.id) return;
    updateShoppingList(
      listId,
      { targetStore: store },
      { restateSavings: true },
    ).catch(reportFailure);
  };

  return {
    list,
    /** Null until the unbought lines are read. */
    costToGo,
    /** The API's EDIT: the owner, a home's MEMBER and above, a collaborator holding canEdit. */
    canEdit: isOwner || permissions.canEditList,
    state,
    retry: () => {
      void refetch();
    },
    saveBudget,
    pickStore,
    setPriceTracking: (value: boolean) => {
      void setPriceTracking(listId, value);
    },
  };
}
