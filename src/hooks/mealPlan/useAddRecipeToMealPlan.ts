import { useCallback, useMemo } from 'react';
import { clamp, parseISO, startOfDay } from 'date-fns';
import { MealType } from '#generated';
import { useMealPlans } from './useMealPlans';
import { useMealPlanItemActions } from './useMealPlanItemActions';
import { toastService } from '#/services/toastService';

interface UseAddRecipeToMealPlanOptions {
  planId?: string | null;
  date?: Date;
}

export function useAddRecipeToMealPlan(options?: UseAddRecipeToMealPlanOptions) {
  const { currentPlan, mealPlans } = useMealPlans();

  const activePlan = useMemo(() => {
    if (options?.planId) {
      return mealPlans.find(p => p.id === options.planId) ?? null;
    }
    return currentPlan ?? mealPlans[0] ?? null;
  }, [options?.planId, currentPlan, mealPlans]);

  const activePlanId = activePlan?.id ?? null;
  const { createItem, creating } = useMealPlanItemActions(activePlanId);

  const targetDate = useMemo(() => {
    if (options?.date) return options.date;
    const today = startOfDay(new Date());
    if (!activePlan) return today;
    const start = startOfDay(parseISO(activePlan.startDate));
    const end = startOfDay(parseISO(activePlan.endDate));
    return clamp(today, { start, end });
  }, [activePlan, options?.date]);

  const addRecipeToMealPlan = useCallback(
    async ({ recipeId, mealType, date }: { recipeId: string; mealType: MealType; date: Date }) => {
      if (!activePlanId) {
        toastService.error('No active meal plan. Create one first.');
        return false;
      }
      const result = await createItem({
        mealPlanId: activePlanId,
        recipeId,
        mealType,
        date: date.toISOString(),
      });
      if (result?.success) {
        toastService.success('Added to meal plan');
        return true;
      }
      return false;
    },
    [activePlanId, createItem],
  );

  return { addRecipeToMealPlan, adding: creating, hasPlan: !!activePlanId, targetDate, mealPlans, activePlanId };
}
