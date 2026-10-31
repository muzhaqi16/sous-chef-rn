import { useFragment } from '@apollo/client/react';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { UseListAsksPrice_ListFragmentDoc } from './useListAsksPrice.generated';

/**
 * Whether the list asks what a recorded line cost, whatever the Budget & prices
 * switch. A list not read yet asks, as tracking is on by default.
 */
export function useListTracksPrices(
  listId: string | null | undefined,
): boolean {
  const read = useFragment({
    fragment: UseListAsksPrice_ListFragmentDoc,
    fragmentName: 'useListAsksPrice_list',
    from: listId ? { __typename: 'ShoppingList', id: listId } : null,
  });
  return read.complete ? read.data.priceTracking : true;
}

/**
 * Whether recording a line of this list asks what it cost: prices are on and
 * the list tracks them.
 */
export function useListAsksPrice(listId: string | null | undefined): boolean {
  const pricesOn = useBudgetAndPricesEnabled();
  const tracks = useListTracksPrices(listId);
  return pricesOn && tracks;
}
