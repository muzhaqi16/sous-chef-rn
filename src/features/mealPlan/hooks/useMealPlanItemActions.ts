import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  UpdateMealPlanItemDocument,
  DeleteMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  MealPlanItemActions_ItemFragmentDoc,
  MealPlanItemActions_PlanBoundsFragmentDoc,
} from './useMealPlanItemActions.generated';
import { useCreateMealPlanItem } from './useCreateMealPlanItem';
import type { CreateMealPlanItemInput } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { MEAL_PLAN_ITEMS_FIELD } from '#features/mealPlan/cache/mealPlanItem';
import type { RemovePlanItemInputs } from '#features/mealPlan/offline/localWrites';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { generateEntityId } from '#/utils/generateEntityId';
import { useTranslation } from '#/i18n';
import { keepDayInsidePlan } from '#/utils/dateUtils';

export function useMealPlanItemActions(mealPlanId: string | null) {
  const client = useApolloClient();
  const { t } = useTranslation();
  const { sendItem, creating } = useCreateMealPlanItem();

  const [updateItemMutation] = useMutation(UpdateMealPlanItemDocument, {
    context: { localFirst: true },
  });

  const [deleteItemMutation] = useMutation(DeleteMealPlanItemDocument, {
    context: { localFirst: true },
  });

  /** `true` once the meal landed or is queued; `false` when it was refused. */
  const createItem = async (
    input: CreateMealPlanItemInput,
  ): Promise<boolean> => {
    const bounds = client.cache.readFragment({
      fragment: MealPlanItemActions_PlanBoundsFragmentDoc,
      fragmentName: 'MealPlanItemActions_planBounds',
      from: { __typename: 'MealPlan', id: input.mealPlanId },
      optimistic: true,
    });
    const settled = await sendItem(
      {
        ...input,
        id: generateEntityId(),
        date: keepDayInsidePlan(input.date, bounds ?? undefined),
      },
      'toast',
    );
    return !settled.failure;
  };

  const toggleCompleted = async (
    id: string,
    options?: { deductFromPantry?: boolean; servings?: number; notes?: string },
  ): Promise<boolean> => {
    const item = client.cache.readFragment({
      fragment: MealPlanItemActions_ItemFragmentDoc,
      fragmentName: 'MealPlanItemActions_item',
      from: { __typename: 'MealPlanItem', id },
      optimistic: true,
    });
    if (!item) {
      toastService.error(t('toasts.mealUpdateFailed'));
      return false;
    }

    const markingComplete = !item.isCompleted;
    const hasRecipe = !!item.recipe;
    const deductFromPantry = options?.deductFromPantry;
    const completedAt = markingComplete ? new Date().toISOString() : null;

    // No idempotencyKey: the write states the `version` it read and every
    // write steps it, so of two completions sent at one version one lands and
    // the other is a VERSION_CONFLICT — the pantry is deducted once.
    const completionInput = {
      id: item.id,
      version: item.version,
      isCompleted: markingComplete,
      completedAt,
      ...(markingComplete && deductFromPantry != null && { deductFromPantry }),
      ...(markingComplete &&
        options?.servings != null && { servings: options.servings }),
      ...(markingComplete &&
        options?.notes != null && { notes: options.notes }),
    };

    const refetchPlan = () => {
      void client.refetchQueries({ include: ['GetMealPlan'] });
    };
    const settled = await sendFields(client.cache, {
      entity: { __typename: 'MealPlanItem', id: item.id },
      fields: {
        isCompleted: markingComplete,
        completedAt,
        servings: options?.servings,
        notes: options?.notes,
      },
      variables: { input: completionInput },
      mutate: updateItemMutation,
      settle: {
        document: UpdateMealPlanItemDocument,
        fallback: t('toasts.mealUpdateFailed'),
        // A stale version means another member changed the meal: show theirs.
        onVersionConflict: refetchPlan,
        present: 'toast',
      },
    });

    if (settled.failure) return false;

    if (markingComplete) {
      toastService.success(
        t(
          hasRecipe && deductFromPantry
            ? 'toasts.mealCompletedDeducted'
            : 'toasts.mealCompleted',
        ),
      );
    }

    return true;
  };

  const deleteItem = async (id: string) => {
    // Claimed for the mutation's duration: a meal-plan event for this id
    // (another member's earlier ITEM_ADDED, or the server's echo) would re-add
    // it. `useMealPlanSubscriptions` checks this before applying.
    if (mealPlanId) {
      subscriptionService.registerPendingDelete(
        id,
        mealPlanId,
        'MealPlanItem',
        'MealPlan',
        MEAL_PLAN_ITEMS_FIELD,
      );
    }

    const inputs: RemovePlanItemInputs = { mealPlanId };
    const settled = await pendingWritesOf(client.cache).send(
      DeleteMealPlanItemDocument,
      { input: { id } },
      write =>
        settleMutation(() => deleteItemMutation(write), {
          document: DeleteMealPlanItemDocument,
          fallback: t('mealTemplateBuilder.failedToRemoveItem'),
          removal: true,
          present: 'toast',
        }),
      inputs,
    );

    // Released on every outcome — settling never throws, so this runs whether
    // the delete committed, was refused, or was queued.
    subscriptionService.unregisterPendingDelete(id);
    return !settled.failure;
  };

  return {
    createItem,
    toggleCompleted,
    deleteItem,
    creating,
  };
}
