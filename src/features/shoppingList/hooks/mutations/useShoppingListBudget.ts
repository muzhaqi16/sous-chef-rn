/**
 * useShoppingListBudget — set a list's budget limit and toggle price tracking.
 *
 * Both ride on updateShoppingList (budget → the `planning` sub-input, price
 * tracking → the `settings` sub-input) as absolute sets keyed by the list id,
 * so both take that operation's tier: DURABLE. They share a Save button with
 * the list rename, which goes through the same mutation — refusing the budget
 * offline while the rename queued made one press half-save, with nothing on
 * screen to say which half.
 *
 * The change is described once as a `WriteIntent`: the kit writes it to the
 * cache permanently before firing, derives the patch that undoes it, and
 * carries it to the queue. The patch is ShoppingList-shaped, not input-shaped —
 * `planning.budgetAmount` on the wire is `budgetAmount` on the entity.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { UpdateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseShoppingListBudget_ListFragmentDoc,
  type UseShoppingListBudget_ListFragment,
} from './useShoppingListBudget.generated';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { toastService } from '#/services/toastService';
import { useWrite } from '#/apollo/write/useWrite';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { generateEntityId } from '#/utils/generateEntityId';
import type { FieldPatch } from '#/apollo/write/writeIntent';
import type { UpdateShoppingListInput } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';

export function useShoppingListBudget() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const { apply } = useWrite();
  const [mutate, { loading }] = useMutation(UpdateShoppingListDocument);

  const runUpdate = async (
    id: string,
    input: Omit<UpdateShoppingListInput, 'id' | 'version'>,
    patch: FieldPatch,
    failureMessage: string,
  ): Promise<boolean> => {
    // The server requires the version: an update sent without one reports
    // success while overwriting a concurrent edit. Read for that and for the
    // is-this-row-cached guard; the intent owns the undo, so nothing else here
    // is snapshotted.
    const current =
      client.cache.readFragment<UseShoppingListBudget_ListFragment>({
        id: client.cache.identify({ __typename: 'ShoppingList', id }),
        fragment: UseShoppingListBudget_ListFragmentDoc,
        fragmentName: 'useShoppingListBudget_list',
      });
    if (!current) {
      toastService.error(failureMessage);
      return false;
    }

    const { context, revert } = apply({
      target: { __typename: 'ShoppingList', id },
      patch: { ...patch, updatedAt: new Date().toISOString() },
      // A budget and a tracking flag are final values the person chose, so a
      // version conflict re-sends against a fresh version rather than
      // discarding what they entered.
      convergence: 'absolute',
    });

    // Built above the try: a conditional inside a try body bails the React
    // Compiler out of the whole function, and this project's baseline is empty.
    const variables = {
      input: {
        id,
        ...input,
        version: current.version,
        // Claimed by the server BEFORE its version check, so a queued replay
        // converges instead of being refused on the stale version it carries.
        idempotencyKey: generateEntityId(),
      },
    };

    let result;
    try {
      result = await mutate({ variables, context });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Update Shopping List budget error:',
      });
    }

    if (!result) {
      revert();
      return false;
    }
    // 'queued' keeps the write — it replays later, and the queue undoes it from
    // the persisted intent if that replay is refused.
    if (classifyCreateResult(result) === 'queued') return true;
    if (alertIfRejected(result, failureMessage)) {
      revert();
      return false;
    }
    return true;
  };

  const setBudget = async (
    id: string,
    budgetAmount: number | null,
    currency?: string | null,
  ): Promise<boolean> =>
    runUpdate(
      id,
      {
        planning: { budgetAmount, ...(currency !== undefined && { currency }) },
      },
      { budgetAmount, ...(currency !== undefined && { currency }) },
      t('shoppingListScreens.failedToSetBudget'),
    );

  const setPriceTracking = async (
    id: string,
    priceTracking: boolean,
  ): Promise<boolean> =>
    runUpdate(
      id,
      { settings: { priceTracking } },
      { priceTracking },
      t('shoppingListScreens.failedToSetPriceTracking'),
    );

  return { setBudget, setPriceTracking, loading };
}
