/**
 * Local-first: the reminder fields are absolute sets keyed by the list id, written
 * to the cache before firing and idempotent on a queued replay. A failure restores
 * the pre-change snapshot and alerts.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  UpdateShoppingListReminderDocument,
  DeleteShoppingListReminderDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseShoppingListReminder_ListFragmentDoc,
  type UseShoppingListReminder_ListFragment,
} from './useShoppingListReminder.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import {
  snapshotFields,
  writeEntityFields,
} from '#/apollo/utils/localFirstFields';

export function useShoppingListReminder() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [setMutation] = useMutation(UpdateShoppingListReminderDocument, {
    context: { localFirst: true },
  });
  const [clearMutation] = useMutation(DeleteShoppingListReminderDocument, {
    context: { localFirst: true },
  });

  /** Writes `patch` over the list and returns what restores the held values. */
  const applyOptimistic = (
    id: string,
    patch: Partial<UseShoppingListReminder_ListFragment>,
  ): (() => void) => {
    const entity = { __typename: 'ShoppingList', id };
    const held =
      client.cache.readFragment<UseShoppingListReminder_ListFragment>({
        id: client.cache.identify(entity),
        fragment: UseShoppingListReminder_ListFragmentDoc,
        fragmentName: 'useShoppingListReminder_list',
        returnPartialData: true,
      });
    const previous = snapshotFields(held, patch);
    writeEntityFields(client.cache, entity, patch);
    return () => writeEntityFields(client.cache, entity, previous);
  };

  const setReminder = async (
    id: string,
    reminderDate: string,
    reminderEnabled = true,
  ): Promise<boolean> => {
    const revert = applyOptimistic(id, { reminderEnabled, reminderDate });

    const settled = await settleMutation(
      () =>
        setMutation({
          variables: { input: { id, reminderDate, reminderEnabled } },
        }),
      {
        document: UpdateShoppingListReminderDocument,
        fallback: t('shoppingListScreens.failedToSetReminder'),
        onFailed: revert,
      },
    );
    return settled.status !== 'failed';
  };

  const clearReminder = async (id: string): Promise<boolean> => {
    const revert = applyOptimistic(id, {
      reminderEnabled: false,
      reminderDate: null,
    });

    const settled = await settleMutation(
      () =>
        clearMutation({
          variables: { input: { id } },
        }),
      {
        document: DeleteShoppingListReminderDocument,
        fallback: t('shoppingListScreens.failedToClearReminder'),
        onFailed: revert,
      },
    );
    return settled.status !== 'failed';
  };

  return { setReminder, clearReminder };
}
