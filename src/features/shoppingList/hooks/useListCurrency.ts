import { skipToken, useFragment, useQuery } from '@apollo/client/react';
import { resolveCurrency, usePreferredCurrency } from '#/domain/money';
import {
  ListCurrencyDocument,
  UseListCurrency_ListFragmentDoc,
} from './useListCurrency.generated';

/**
 * The currency a price recorded on the list is in: the list's own, else the
 * account's, as the API records one. Null until the device has read the list,
 * which it then asks for: the account's would name the wrong currency.
 */
export function useListCurrency(
  listId: string | null | undefined,
): string | null {
  const preferred = usePreferredCurrency();
  const read = useFragment({
    fragment: UseListCurrency_ListFragmentDoc,
    fragmentName: 'useListCurrency_list',
    from: listId ? { __typename: 'ShoppingList', id: listId } : null,
  });
  useQuery(
    ListCurrencyDocument,
    listId && !read.complete
      ? { variables: { id: listId }, fetchPolicy: 'cache-first' }
      : skipToken,
  );
  if (!read.complete) return null;
  return resolveCurrency(
    read.data.currency ? { code: read.data.currency } : null,
    preferred,
  );
}
