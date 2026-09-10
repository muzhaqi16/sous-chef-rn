/**
 * All three are local-first. setRecurring / cancelRecurring are absolute sets
 * keyed by the list id. generateNext rolls the occurrence on the device: a copy
 * under minted ids, then the same `CreateRecurringShoppingList` that sets a
 * schedule, carrying the advanced pointer.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  CreateRecurringShoppingListDocument,
  CancelRecurringDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseRecurringShoppingList_ListFragmentDoc,
  type UseRecurringShoppingList_ListFragment,
} from './useRecurringShoppingList.generated';
import { readCopyableList } from '#features/shoppingList/cache/copySource';
import { nextRecurringList } from '#features/shoppingList/utils/nextRecurringList';
import { useCopyShoppingList } from './useCopyShoppingList';
import type { RecurringPattern } from '#/graphql/generated/schemaTypes';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { applyOptimisticFragmentPatch } from '#/apollo/utils/cacheUpdaters';
import { formatMonthDayYear } from '#/utils/formatters/date';
import { toastService } from '#/services/toastService';
import { errorService } from '#/services/errorService';

export function useRecurringShoppingList() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [setupMutation, { loading: settingUp }] = useMutation(
    CreateRecurringShoppingListDocument,
  );
  const [cancelMutation, { loading: cancelling }] = useMutation(
    CancelRecurringDocument,
  );
  const { copyList, copying: generating } = useCopyShoppingList(
    t('shoppingListScreens.failedToGenerateNext'),
  );

  const applyOptimistic = (
    id: string,
    patch: Partial<UseRecurringShoppingList_ListFragment>,
    label: string,
  ): (() => void) =>
    applyOptimisticFragmentPatch(
      client.cache,
      { typename: 'ShoppingList', id },
      {
        fragment: UseRecurringShoppingList_ListFragmentDoc,
        fragmentName: 'useRecurringShoppingList_list',
      },
      patch,
      label,
    );

  const setRecurring = async (
    id: string,
    pattern: RecurringPattern,
    interval: number,
  ): Promise<boolean> => {
    const revert = applyOptimistic(
      id,
      {
        isRecurring: true,
        recurringPattern: pattern,
        recurringInterval: interval,
      },
      'Set Recurring',
    );

    let result;
    try {
      result = await setupMutation({
        variables: {
          input: {
            id,
            recurringPattern: pattern,
            recurringInterval: interval,
          },
        },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Set Recurring error:',
      });
    }

    if (!result) {
      revert();
      return false;
    }
    if (
      alertIfRejected(result, t('shoppingListScreens.failedToSetRecurring'))
    ) {
      revert();
      return false;
    }
    return true;
  };

  const cancelRecurring = async (id: string): Promise<boolean> => {
    const revert = applyOptimistic(
      id,
      { isRecurring: false },
      'Cancel Recurring',
    );

    let result;
    try {
      result = await cancelMutation({
        variables: { input: { id } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Cancel Recurring error:',
      });
    }

    if (!result) {
      revert();
      return false;
    }
    if (
      alertIfRejected(result, t('shoppingListScreens.failedToCancelRecurring'))
    ) {
      revert();
      return false;
    }
    return true;
  };

  const readRecurrence = (id: string) =>
    client.cache.readFragment<UseRecurringShoppingList_ListFragment>({
      id: client.cache.identify({ __typename: 'ShoppingList', id }),
      fragment: UseRecurringShoppingList_ListFragmentDoc,
      fragmentName: 'useRecurringShoppingList_list',
    });

  /** The next occurrence's list id, or null when it could not be rolled. */
  const generateNext = async (id: string): Promise<string | null> => {
    const recurrence = readRecurrence(id);
    const source = readCopyableList(client.cache, id);
    if (!recurrence || !source) {
      toastService.error(t('shoppingListScreens.copySourceNotLoaded'));
      return null;
    }
    // The same refusal the server raises on `id`, made before anything is
    // written rather than after a round trip.
    if (!recurrence.isRecurring) {
      toastService.error(t('shoppingListScreens.notRecurring'));
      return null;
    }

    const derived = nextRecurringList(source, {
      pattern: recurrence.recurringPattern,
      interval: recurrence.recurringInterval,
      name: t('shoppingListScreens.recurringListName', {
        name: source.name,
        date: formatMonthDayYear(new Date()),
      }),
    });

    // Copy FIRST, advance the pointer after. The server claims the pointer
    // first so a lost race creates nothing; here there is no race to lose, and
    // a create that never happened must not move the schedule past it.
    const listId = await copyList(derived);
    if (!listId) return null;

    await advancePointer(id, recurrence, derived.nextRecurringDate);

    if (derived.skipped.length > 0) {
      toastService.info(
        t('shoppingListScreens.copyLinesSkipped', {
          count: derived.skipped.length,
        }),
      );
    }
    return listId;
  };

  /**
   * Moves the source list's `nextRecurringDate` on. Both schedule fields are
   * nullable and the input's are not, so a list recurring without them keeps
   * its pointer rather than having one guessed for it. The server also stamps
   * `lastRecurredAt` here, which no client input reaches.
   */
  async function advancePointer(
    id: string,
    recurrence: UseRecurringShoppingList_ListFragment,
    nextRecurringDate: string,
  ) {
    const { recurringPattern, recurringInterval } = recurrence;
    if (recurringPattern == null || recurringInterval == null) return;

    const revert = applyOptimistic(
      id,
      { nextRecurringDate },
      'Advance Recurrence',
    );
    let result;
    try {
      result = await setupMutation({
        variables: {
          input: {
            id,
            recurringPattern,
            recurringInterval,
            nextRecurringDate,
          },
        },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Advance Recurrence error:',
      });
    }
    if (!result) revert();
  }

  return {
    setRecurring,
    cancelRecurring,
    generateNext,
    settingUp,
    cancelling,
    generating,
  };
}
