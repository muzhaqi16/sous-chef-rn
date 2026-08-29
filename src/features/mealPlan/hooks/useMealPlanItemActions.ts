/**
 * useMealPlanItemActions - Meal plan item create / update / toggle / delete.
 *
 * Online-only. Meal-plan authoring happens at home on connectivity, so each
 * action refuses up front when the API is unreachable rather than writing the
 * cache ahead of the server and replaying later. Every cache change here is
 * driven by the server's response: Apollo normalizes the returned item by id,
 * and the `mealPlanItems` array is edited in the mutations' `update` callbacks.
 *
 * `isApiUnavailable` is returned so screens can disable the affordances instead
 * of surfacing the refusal only after a tap.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  CreateMealPlanItemDocument,
  UpdateMealPlanItemDocument,
  DeleteMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import { MealPlanItemActions_ItemFragmentDoc } from './useMealPlanItemActions.generated';
import {
  type CreateMealPlanItemInput,
  type UpdateMealPlanItemInput,
} from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import {
  createAddToParentArrayUpdater,
  createRemoveFromParentArrayUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { generateEntityId } from '#/utils/generateEntityId';
import { t } from '#/i18n';
import { errorService } from '#/services/errorService';

const addToMealPlanItems = createAddToParentArrayUpdater<{ id: string }>(
  'MealPlan',
  'mealPlanItems',
);
const removeFromMealPlanItems = createRemoveFromParentArrayUpdater(
  'MealPlan',
  'mealPlanItems',
  'MealPlanItem',
);

export function useMealPlanItemActions(mealPlanId: string | null) {
  const client = useApolloClient();
  const isApiUnavailable = useIsApiUnavailable();

  const [createItemMutation, { loading: creating }] = useMutation(
    CreateMealPlanItemDocument,
    {
      update(cache, { data }) {
        const result = data?.createMealPlanItem;
        if (result?.__typename !== 'CreateMealPlanItemPayload' || !mealPlanId) {
          return;
        }
        addToMealPlanItems(cache, mealPlanId, result.mealPlanItem, {
          position: 'end',
        });
      },
    },
  );

  // No update/refetch needed — the mutation returns the full mealPlanItem
  // with id, so Apollo auto-normalizes the cache entry.
  const [updateItemMutation, { loading: updating }] = useMutation(
    UpdateMealPlanItemDocument,
  );

  const [deleteItemMutation, { loading: deleting }] = useMutation(
    DeleteMealPlanItemDocument,
    {
      // The deleted row leaves the parent's `mealPlanItems` array only once the
      // server has confirmed it; normalization alone would leave a dangling ref.
      update(cache, { data }) {
        const result = data?.deleteMealPlanItem;
        if (result?.__typename !== 'DeleteMealPlanItemPayload' || !mealPlanId) {
          return;
        }
        removeFromMealPlanItems(cache, mealPlanId, result.mealPlanItem.id, {
          evictItem: true,
        });
      },
    },
  );

  const createItem = async (input: CreateMealPlanItemInput) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return null;
    }

    // Client-minted permanent cuid: a repeated create (a double-tap, or a retry
    // whose first response was lost) converges on the existing row server-side
    // instead of adding a second custom meal.
    const id = generateEntityId();

    let result;
    try {
      result = await createItemMutation({
        variables: { input: { ...input, id } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Create Meal Plan Item error:',
      });
    }

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      // The server's `message` is unlocalizable English by construction, so it
      // is never what the person reads.
      toastService.error(t('errors.addItemFailed'));
      return null;
    }

    const payload = result ? result.data?.createMealPlanItem : null;
    if (payload?.__typename === 'CreateMealPlanItemPayload') return payload;

    // Classified as created but carrying no payload: an IDEMPOTENT_REPLAY
    // conflict, which means the row IS on the server — the client-minted id was
    // sent twice. The `update` callback only fires for the payload member, so
    // nothing added it to `MealPlan.mealPlanItems`; without this the meal is
    // saved and invisible, with no message either way.
    if (outcome === 'created') {
      client.refetchQueries({ include: ['GetMealPlan'] });
    }
    return null;
  };

  const updateItem = async (
    id: string,
    input: Omit<UpdateMealPlanItemInput, 'id'>,
  ) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return null;
    }

    let result;
    try {
      result = await updateItemMutation({
        variables: { input: { ...input, id } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Update Meal Plan Item error:',
      });
    }

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      // The server's `message` is unlocalizable English by construction.
      toastService.error(t('toasts.mealUpdateFailed'));
      return null;
    }
    const payload = result ? result.data?.updateMealPlanItem : null;
    return payload?.__typename === 'UpdateMealPlanItemPayload' ? payload : null;
  };

  const toggleCompleted = async (
    id: string,
    options?: { deductFromPantry?: boolean; servings?: number; notes?: string },
  ) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return null;
    }

    // Callers pass only an id, so read the row to branch on its current
    // completion state and on whether it has a recipe.
    const item = client.cache.readFragment({
      fragment: MealPlanItemActions_ItemFragmentDoc,
      fragmentName: 'MealPlanItemActions_item',
      from: { __typename: 'MealPlanItem', id },
    });
    if (!item) {
      toastService.error(t('toasts.mealUpdateFailed'));
      return null;
    }

    const markingComplete = !item.isCompleted;
    const hasRecipe = !!item.recipe;
    const deductFromPantry = options?.deductFromPantry;
    const completedAt = markingComplete ? new Date().toISOString() : null;

    // The server gates the pantry deduction on the false → true completion
    // transition read live from the pre-update row, so a repeated completion
    // finds the item already isCompleted and never double-deducts. Confirmed
    // server-side in sous-chef-api#178.
    let result;
    const updateItemMutationOptions = {
      variables: {
        input: {
          id: item.id,
          isCompleted: markingComplete,
          completedAt,
          ...(markingComplete &&
            deductFromPantry != null && { deductFromPantry }),
          ...(markingComplete &&
            options?.servings != null && { servings: options.servings }),
          ...(markingComplete &&
            options?.notes != null && { notes: options.notes }),
        },
      },
    };
    try {
      result = await updateItemMutation(updateItemMutationOptions);
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Toggle Meal Plan Item error:',
      });
    }

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      // The server's `message` is unlocalizable English by construction.
      toastService.error(t('toasts.mealUpdateFailed'));
      return null;
    }

    if (markingComplete) {
      if (hasRecipe && deductFromPantry) {
        toastService.success(t('toasts.mealCompletedDeducted'));
      } else {
        toastService.success(t('toasts.mealCompleted'));
      }
    }

    const payload = result ? result.data?.updateMealPlanItem : null;
    return payload?.__typename === 'UpdateMealPlanItemPayload' ? payload : null;
  };

  const deleteItem = async (id: string) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    // Claim the row for the duration of the mutation. A meal-plan event for
    // this same id — another member's earlier ITEM_ADDED still in flight, or
    // the server's own echo — would otherwise re-add it to `mealPlanItems`
    // around the removal below, and the meal would reappear.
    // `useMealPlanSubscriptions` checks this before applying anything.
    if (mealPlanId) {
      subscriptionService.registerPendingDelete(
        id,
        mealPlanId,
        'MealPlanItem',
        'MealPlan',
        'mealPlanItems',
      );
    }

    let result;
    try {
      result = await deleteItemMutation({
        variables: { input: { id } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Delete Meal Plan Item error:',
      });
    }

    // Released on every outcome — `executeMutation` reports rather than throws,
    // so this runs whether the delete committed or was refused.
    subscriptionService.unregisterPendingDelete(id);

    const outcome = classifyCreateResult(result);

    if (outcome === 'rejected') {
      return false;
    }
    return true;
  };

  return {
    createItem,
    updateItem,
    toggleCompleted,
    deleteItem,
    loading: creating || updating || deleting,
    creating,
    updating,
    deleting,
    isApiUnavailable,
  };
}
