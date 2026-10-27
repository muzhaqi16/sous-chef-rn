import { useFragment } from '@apollo/client/react';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { UseListAsksPrice_ListFragmentDoc } from './useListAsksPrice.generated';

/**
 * Whether recording a line of this list asks what it cost: prices are on and
 * the list tracks them. A list not read yet asks, as tracking is on by default.
 */
export function useListAsksPrice(listId: string | null | undefined): boolean {
  const pricesOn = useBudgetAndPricesEnabled();
  const read = useFragment({
    fragment: UseListAsksPrice_ListFragmentDoc,
    fragmentName: 'useListAsksPrice_list',
    from: listId ? { __typename: 'ShoppingList', id: listId } : null,
  });
  return pricesOn && (read.complete ? read.data.priceTracking : true);
}
