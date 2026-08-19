/**
 * useRecurringShoppingList — turn a list's recurrence on/off and generate the
 * next occurrence.
 *
 * setRecurring / cancelRecurring are local-first: the recurrence fields are
 * absolute sets keyed by the list id, so we write them to the cache before
 * firing and a queued replay re-applies the same state idempotently. A real
 * rejection restores the pre-change snapshot and alerts.
 *
 * generateNext is ONLINE-ONLY: it creates a brand-new list whose id the server
 * mints, so there's no client id to key idempotency on — a queued replay would
 * spawn duplicates. It adds the created list to the overview connection (same
 * updater createShoppingList uses) and returns its id for navigation.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  CreateRecurringShoppingListDocument,
  CancelRecurringDocument,
  GenerateNextRecurringListDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseRecurringShoppingList_ListFragmentDoc,
  type UseRecurringShoppingList_ListFragment,
} from './useRecurringShoppingList.generated';
import { addShoppingListToQueryCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import type { RecurringPattern } from '#/graphql/generated/schemaTypes';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { applyOptimisticFragmentPatch } from '#/apollo/utils/cacheUpdaters';
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
  const [generateMutation, { loading: generating }] = useMutation(
    GenerateNextRecurringListDocument,
    {
      update(cache, { data }) {
        if (
          data?.generateNextRecurringList?.__typename ===
          'GenerateNextRecurringListPayload'
        ) {
          addShoppingListToQueryCache(
            cache,
            data.generateNextRecurringList.shoppingList,
          );
        }
      },
    },
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

  // Returns the created list's id (for navigation) or null on failure.
  const generateNext = async (id: string): Promise<string | null> => {
    let result;
    try {
      result = await generateMutation({ variables: { input: { id } } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Generate Next Recurring List error:',
      });
    }

    if (!result) return null;
    if (
      alertIfRejected(result, t('shoppingListScreens.failedToGenerateNext'))
    ) {
      return null;
    }
    const payload = result.data?.generateNextRecurringList;
    return payload?.__typename === 'GenerateNextRecurringListPayload'
      ? payload.shoppingList.id
      : null;
  };

  return {
    setRecurring,
    cancelRecurring,
    generateNext,
    settingUp,
    cancelling,
    generating,
  };
}
