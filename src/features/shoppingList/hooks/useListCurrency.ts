import { useFragment } from '@apollo/client/react';
import { resolveCurrency, usePreferredCurrency } from '#/domain/money';
import { UseListCurrency_ListFragmentDoc } from './useListCurrency.generated';

/**
 * The currency a price recorded on the list is in: the list's own, else the
 * account's, as the API records a cost with no currency of its own.
 */
export function useListCurrency(listId: string | null | undefined): string {
  const preferred = usePreferredCurrency();
  const read = useFragment({
    fragment: UseListCurrency_ListFragmentDoc,
    fragmentName: 'useListCurrency_list',
    from: listId ? { __typename: 'ShoppingList', id: listId } : null,
  });
  return resolveCurrency(
    read.complete && read.data.currency ? { code: read.data.currency } : null,
    preferred,
  );
}
