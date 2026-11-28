/**
 * Local-first, via the dedicated markShoppingListAsDefault: the server unsets the
 * other default in the same transaction, so only THIS list's flag flips locally
 * (an absolute set keyed by the list id, idempotent on a queued replay) and the
 * stale one clears when the response lands — a brief two-defaults flash.
 */

import { useTranslation } from '#i18n';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { markShoppingListAsDefaultWrite } from '#features/shoppingList/offline/localWrites';

export function useSetDefaultShoppingList() {
  const { t } = useTranslation();
  const markDefault = useLocalWrite(markShoppingListAsDefaultWrite, {
    fallback: t('shoppingListScreens.failedToSetDefault'),
  });

  const setAsDefault = async (id: string): Promise<boolean> => {
    const settled = await markDefault.send(
      { input: { id } },
      {
        entity: { __typename: 'ShoppingList', id },
        fields: { isDefault: true },
      },
    );
    return settled.status !== 'failed';
  };

  return { setAsDefault };
}
