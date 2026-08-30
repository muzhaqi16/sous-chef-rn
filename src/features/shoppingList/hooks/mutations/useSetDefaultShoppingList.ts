/**
 * Local-first, via the dedicated markShoppingListAsDefault: the server unsets the
 * other default in the same transaction, so only THIS list's flag flips locally
 * (an absolute set keyed by the list id, idempotent on a queued replay) and the
 * stale one clears when the response lands — a brief two-defaults flash.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { MarkShoppingListAsDefaultDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { errorService } from '#/services/errorService';

export function useSetDefaultShoppingList() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [mutate, { loading }] = useMutation(MarkShoppingListAsDefaultDocument);

  const setAsDefault = async (id: string): Promise<boolean> => {
    const cacheId = client.cache.identify({ __typename: 'ShoppingList', id });
    let previous: boolean | undefined;

    try {
      client.cache.modify({
        id: cacheId,
        fields: {
          isDefault(existing: boolean) {
            previous = existing;
            return true;
          },
        },
      });
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Set Default Shopping List (optimistic)',
      });
    }

    const revert = () => {
      if (previous !== undefined) {
        try {
          client.cache.modify({
            id: cacheId,
            fields: { isDefault: () => previous },
          });
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Revert Set Default Shopping List',
          });
        }
      }
    };

    let result;
    try {
      result = await mutate({
        variables: { input: { id } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Set Default Shopping List error:',
      });
    }

    if (!result) {
      revert();
      return false;
    }
    if (alertIfRejected(result, t('shoppingListScreens.failedToSetDefault'))) {
      revert();
      return false;
    }
    return true;
  };

  return { setAsDefault, loading };
}
