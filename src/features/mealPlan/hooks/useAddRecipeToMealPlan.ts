import type { MealType } from '#/graphql/generated/schemaTypes';
import { useMealPlanDisplay, useMealPlans } from './useMealPlans';
import { useMealPlanItemActions } from './useMealPlanItemActions';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n';

interface UseAddRecipeToMealPlanOptions {
  planId?: string | null;
}

export function useAddRecipeToMealPlan(
  options?: UseAddRecipeToMealPlanOptions,
) {
  const {
    state: { currentPlan, mealPlans: loadedPlans, hasMore, loadingMore },
    actions: { loadMore },
  } = useMealPlans();

  // A picked plan is read by id, so one from a later page resolves too.
  const pickedPlan = useMealPlanDisplay(options?.planId ?? null);
  const activePlan = options?.planId ? pickedPlan : currentPlan;

  // The current plan may sit past the loaded pages; it leads so it is pickable.
  const mealPlans =
    activePlan && !loadedPlans.some(plan => plan.id === activePlan.id)
      ? [activePlan, ...loadedPlans]
      : loadedPlans;

  const activePlanId = activePlan?.id ?? null;
  const { createItem, creating } = useMealPlanItemActions(activePlanId);

  const addRecipeToMealPlan = async ({
    recipeId,
    mealType,
    date,
  }: {
    recipeId: string;
    mealType: MealType;
    date: Date;
  }) => {
    if (!activePlanId) {
      toastService.error(t('errors.noActiveMealPlan'));
      return false;
    }
    const added = await createItem({
      mealPlanId: activePlanId,
      meal: { recipeId },
      mealType,
      date: date.toISOString(),
    });
    if (added) {
      toastService.success(t('toasts.addedToMealPlan'));
      return true;
    }
    return false;
  };

  return {
    addRecipeToMealPlan,
    adding: creating,
    hasPlan: !!activePlanId,
    mealPlans,
    activePlan,
    activePlanId,
    hasMorePlans: hasMore,
    loadingMorePlans: loadingMore,
    loadMorePlans: () => {
      void loadMore();
    },
  };
}
