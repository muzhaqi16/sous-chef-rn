/**
 * useSetDefaultShoppingList — mark a list as the user's default (online-only).
 *
 * Uses the dedicated markShoppingListAsDefault mutation rather than
 * updateShoppingList({ isDefault: true }) because the server unsets the previous
 * default in the same transaction. The payload returns this list's new
 * isDefault, which Apollo normalizes by id; the previously-default list clears
 * when the cache-and-network refetch lands.
 */

import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { MarkShoppingListAsDefaultDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { toastService } from '#/services/toastService';
import { errorService } from '#/services/errorService';

export function useSetDefaultShoppingList() {
  const { t } = useTranslation();
  const [mutate, { loading }] = useMutation(MarkShoppingListAsDefaultDocument);
  const isApiUnavailable = useIsApiUnavailable();

  const setAsDefault = async (id: string): Promise<boolean> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await mutate({ variables: { input: { id } } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Set Default Shopping List error:',
      });
    }

    if (!result) return false;
    if (alertIfRejected(result, t('shoppingListScreens.failedToSetDefault'))) {
      return false;
    }
    return true;
  };

  return { setAsDefault, loading, isApiUnavailable };
}
