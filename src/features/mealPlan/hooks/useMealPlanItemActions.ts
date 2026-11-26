import { useApolloClient } from '@apollo/client/react';
import {
  MealPlanItemActions_ItemFragmentDoc,
  MealPlanItemActions_PlanBoundsFragmentDoc,
} from './useMealPlanItemActions.generated';
import { useCreateMealPlanItem } from './useCreateMealPlanItem';
import type { CreateMealPlanItemInput } from '#graphql/generated/schemaTypes';
import { toastService } from '#services/toastService';
import { MEAL_PLAN_ITEMS_FIELD } from '#features/mealPlan/cache/mealPlanItem';
import type { RemovePlanItemInputs } from '#features/mealPlan/offline/localWrites';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { subscriptionService } from '#services/subscriptions/SubscriptionService';
import { generateEntityId } from '#utils/generateEntityId';
import { useTranslation } from '#i18n';
import { keepDayInsidePlan } from '#utils/dateUtils';
import {
  deleteMealPlanItemWrite,
  updateMealPlanItemWrite,
} from '#features/mealPlan/offline/localWrites';

export function useMealPlanItemActions(mealPlanId: string | null) {
  const client = useApolloClient();
  const { t } = useTranslation();
  const { sendItem, creating } = useCreateMealPlanItem();

  const updateItem = useLocalWrite(updateMealPlanItemWrite, {
    fallback: t('toasts.mealUpdateFailed'),
    // A stale version means another member changed the meal: show theirs.
    onVersionConflict: () => {
      void client.refetchQueries({ include: ['GetMealPlan'] });
    },
    present: 'toast',
  });

  const removeItem = useLocalWrite(deleteMealPlanItemWrite, {
    fallback: t('mealTemplateBuilder.failedToRemoveItem'),
    removal: true,
    present: 'toast',
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

    const settled = await updateItem.send(
      { input: completionInput },
      {
        entity: { __typename: 'MealPlanItem', id: item.id },
        fields: {
          isCompleted: markingComplete,
          completedAt,
          servings: options?.servings,
          notes: options?.notes,
        },
      },
    );

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
    const settled = await removeItem.send({ input: { id } }, inputs);

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
