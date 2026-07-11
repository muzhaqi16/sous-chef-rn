/**
 * useSetDefaultShoppingList — mark a list as the user's default (local-first).
 *
 * Uses the dedicated markShoppingListAsDefault mutation rather than
 * updateShoppingList({ isDefault: true }) because the server unsets the previous
 * default in the same transaction. We optimistically flip only THIS list's
 * isDefault before firing (an absolute set keyed by the list id, idempotent on a
 * queued replay); the previously-default list clears when the network response /
 * cache-and-network refetch lands — a brief two-defaults flash that self-heals.
 * A real rejection restores the prior flag and alerts.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { MarkShoppingListAsDefaultDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';

export function useSetDefaultShoppingList() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [mutate, { loading }] = useMutation(MarkShoppingListAsDefaultDocument);

  const setAsDefault = async (id: string): Promise<boolean> => {
    const cacheId = client.cache.identify({ __typename: 'ShoppingList', id });
    let previous: boolean | undefined;

    executeCacheUpdate(
      () =>
        client.cache.modify({
          id: cacheId,
          fields: {
            isDefault(existing: boolean) {
              previous = existing;
              return true;
            },
          },
        }),
      'Set Default Shopping List (optimistic)',
    );

    const revert = () => {
      if (previous !== undefined) {
        executeCacheUpdate(
          () =>
            client.cache.modify({
              id: cacheId,
              fields: { isDefault: () => previous },
            }),
          'Revert Set Default Shopping List',
        );
      }
    };

    const result = await executeMutation(
      () =>
        mutate({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      'Set Default Shopping List error:',
    );

    if (!result) {
      revert();
      return false;
    }
    if (
      alertIfRejected(
        result,
        'markShoppingListAsDefault',
        'MarkShoppingListAsDefaultPayload',
        t('shoppingListScreens.failedToSetDefault'),
      )
    ) {
      revert();
      return false;
    }
    return true;
  };

  return { setAsDefault, loading };
}
