/**
 * Local-first, via the dedicated markShoppingListAsDefault: the server unsets the
 * other default in the same transaction, so only THIS list's flag flips locally
 * (an absolute set keyed by the list id, idempotent on a queued replay) and the
 * stale one clears when the response lands — a brief two-defaults flash.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { MarkShoppingListAsDefaultDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { sendFields } from '#/apollo/pendingWrites/sendFields';

export function useSetDefaultShoppingList() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [mutate] = useMutation(MarkShoppingListAsDefaultDocument, {
    context: { localFirst: true },
  });

  const setAsDefault = async (id: string): Promise<boolean> => {
    const settled = await sendFields(client.cache, {
      entity: { __typename: 'ShoppingList', id },
      fields: { isDefault: true },
      variables: { input: { id } },
      mutate,
      settle: {
        document: MarkShoppingListAsDefaultDocument,
        fallback: t('shoppingListScreens.failedToSetDefault'),
      },
    });
    return settled.status !== 'failed';
  };

  return { setAsDefault };
}
