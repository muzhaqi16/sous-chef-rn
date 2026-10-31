import { useFragment } from '@apollo/client/react';
import { formatCurrency } from '#/utils/formatters/number';
import {
  UseListCostToGo_ListFragmentDoc,
  type UseListCostToGo_ListFragment,
} from './useListCostToGo.generated';

/**
 * What a list's unbought lines will cost: each one's estimate, else its
 * suggestion. `amount` is null when no unbought line has a price.
 */
export type ListCostToGo = Omit<
  UseListCostToGo_ListFragment['costToGo'],
  '__typename'
>;

/** The list's cost to go as the device last read it; null until it has. */
export function useListCostToGo(
  listId: string | null | undefined,
): ListCostToGo | null {
  const read = useFragment({
    fragment: UseListCostToGo_ListFragmentDoc,
    fragmentName: 'useListCostToGo_list',
    from: listId ? { __typename: 'ShoppingList', id: listId } : null,
  });
  return read.complete ? read.data.costToGo : null;
}

/** The cost to go as money, or null when nothing is priced. */
export const formatCostToGo = (cost: ListCostToGo): string | null =>
  cost.amount == null ? null : formatCurrency(cost.amount, cost.currency);
