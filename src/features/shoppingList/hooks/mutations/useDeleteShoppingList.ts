/**
 * useDeleteShoppingList - Delete a shopping list (online-only).
 *
 * The cache removal runs in `update`, on the server's real result: the overview
 * edge and the entity go once the delete has actually committed. Offline the
 * call is refused up front, so nothing is removed and nothing replays.
 *
 * Returns whether the list was actually deleted. Callers navigate away and
 * clear the selection on the strength of it — before this was online-only an
 * offline delete was queued and returned a result, so "it resolved" meant "it
 * happened"; now it does not, and a caller that assumes otherwise reports a
 * deletion that never occurred.
 */

import { useMutation } from '@apollo/client/react';
import { DeleteShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { removeShoppingListFromCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { toastService } from '#/services/toastService';
import { getErrorMessage } from '#/services/errorService';
import { errorService } from '#/services/errorService';
import { t } from '#/i18n';

export function useDeleteShoppingList() {
  const [mutate, { loading }] = useMutation(DeleteShoppingListDocument, {
    update(cache, { data }) {
      const payload = data?.deleteShoppingList;
      if (payload?.__typename !== 'DeleteShoppingListPayload') return;
      const deletedId = payload.shoppingList.id;
      try {
        removeShoppingListFromCache(cache, deletedId);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Delete Shopping List (cache removal)',
        });
      }
    },
    onError: error => {
      toastService.error(getErrorMessage(error));
    },
  });

  const isApiUnavailable = useIsApiUnavailable();

  const deleteShoppingList = async (id: string): Promise<boolean> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await mutate({ variables: { input: { id } } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Delete Shopping List error:',
      });
    }

    // `errorPolicy: 'all'` resolves a refusal rather than throwing, and a
    // refusal arrives as a non-payload union member — so neither a throw nor
    // `result.error` alone tells the caller whether the row is gone.
    const payload = result?.data?.deleteShoppingList;
    return payload?.__typename === 'DeleteShoppingListPayload';
  };

  return { deleteShoppingList, loading, isApiUnavailable };
}
