import { clamp, parseISO, startOfDay } from 'date-fns';
import { MealType } from '#/graphql/generated/schemaTypes';
import { useMealPlans } from './useMealPlans';
import { useMealPlanItemActions } from './useMealPlanItemActions';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n';

interface UseAddRecipeToMealPlanOptions {
  planId?: string | null;
  date?: Date;
}

export function useAddRecipeToMealPlan(
  options?: UseAddRecipeToMealPlanOptions,
) {
  const {
    state: { currentPlan, mealPlans },
  } = useMealPlans();

  const activePlan = (() => {
    if (options?.planId) {
      return mealPlans.find(p => p.id === options.planId) ?? null;
    }
    return currentPlan ?? mealPlans[0] ?? null;
  })();

  const activePlanId = activePlan?.id ?? null;
  const { createItem, creating } = useMealPlanItemActions(activePlanId);

  const targetDate = (() => {
    if (options?.date) return options.date;
    const today = startOfDay(new Date());
    if (!activePlan) return today;
    const start = startOfDay(parseISO(activePlan.startDate));
    const end = startOfDay(parseISO(activePlan.endDate));
    return clamp(today, { start, end });
  })();

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
    const result = await createItem({
      mealPlanId: activePlanId,
      meal: { recipeId },
      mealType,
      date: date.toISOString(),
    });
    if (result?.__typename === 'CreateMealPlanItemPayload') {
      toastService.success(t('toasts.addedToMealPlan'));
      return true;
    }
    return false;
  };

  return {
    addRecipeToMealPlan,
    adding: creating,
    hasPlan: !!activePlanId,
    targetDate,
    mealPlans,
    activePlanId,
  };
}
