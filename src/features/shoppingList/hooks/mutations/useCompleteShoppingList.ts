/**
 * useCompleteShoppingList — mark a shopping list complete / reactivate it
 * (local-first).
 *
 * Finishing a shopping trip is exactly the moment you're likely offline (at the
 * store, no signal), so both directions describe the status change as a
 * `WriteIntent`: the kit writes it to the cache PERMANENTLY before firing,
 * derives the patch that undoes it, and carries both to the queue.
 *
 * Both writes are `absolute` — each carries the final state the person chose
 * (completed, or active again), keyed by the list id — so a queued replay
 * re-applies the same state rather than compounding, and a version conflict is
 * resolved by re-sending against a fresh version.
 *
 * There is no mutation `onError` here, so `alertIfRejected` is the sole alerter:
 * it covers the resolved union refusal AND the resolved transport error that
 * `errorPolicy: 'all'` produces, both with localized copy.
 */

import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  CompleteShoppingListDocument,
  MarkShoppingListActiveDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { ListStatus } from '#/graphql/generated/schemaTypes';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { useWrite } from '#/apollo/write/useWrite';
import { errorService } from '#/services/errorService';

export function useCompleteShoppingList() {
  const { t } = useTranslation();
  const { apply } = useWrite();
  const [completeMutation, { loading: completing }] = useMutation(
    CompleteShoppingListDocument,
  );
  const [reactivateMutation, { loading: reactivating }] = useMutation(
    MarkShoppingListActiveDocument,
  );

  const completeList = async (
    id: string,
    totalCost?: number,
  ): Promise<boolean> => {
    const now = new Date().toISOString();
    const { context, revert } = apply({
      target: { __typename: 'ShoppingList', id },
      patch: {
        status: ListStatus.Completed,
        isCompleted: true,
        completedShopDate: now,
        // Bumped so watchers of the list re-render on the local write alone.
        updatedAt: now,
      },
      convergence: 'absolute',
    });

    // Built above the try: a value block (`&&`, `??`, `?.`, a ternary) inside a
    // try body bails the React Compiler out of the whole hook.
    const input = {
      id,
      completedShopDate: now,
      ...(totalCost !== undefined && { totalCost }),
    };

    let result;
    try {
      result = await completeMutation({ variables: { input }, context });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Complete Shopping List error:',
      });
    }

    if (!result) {
      // mutate() threw (non-queueable transport failure) — the visible revert is
      // the feedback; executeMutation already logged the error.
      revert();
      return false;
    }
    if (alertIfRejected(result, t('shoppingListScreens.failedToComplete'))) {
      // Refused on the spot, so it never entered the queue and the queue's
      // withdrawal will never see it. A queued write refused on a later replay
      // is undone from its persisted intent instead.
      revert();
      return false;
    }
    // Applied (server) or queued (offline) — keep the local write.
    return true;
  };

  const reactivateList = async (id: string): Promise<boolean> => {
    const now = new Date().toISOString();
    const { context, revert } = apply({
      target: { __typename: 'ShoppingList', id },
      patch: {
        status: ListStatus.Active,
        isCompleted: false,
        completedShopDate: null,
        updatedAt: now,
      },
      convergence: 'absolute',
    });

    let result;
    try {
      result = await reactivateMutation({
        variables: { input: { id } },
        context,
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Reactivate Shopping List error:',
      });
    }

    if (!result) {
      revert();
      return false;
    }
    if (alertIfRejected(result, t('shoppingListScreens.failedToReactivate'))) {
      revert();
      return false;
    }
    return true;
  };

  return { completeList, reactivateList, completing, reactivating };
}
