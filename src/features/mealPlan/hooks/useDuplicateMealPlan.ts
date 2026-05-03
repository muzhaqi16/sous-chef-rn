import { useMutation } from '@apollo/client/react';
import { DuplicateMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { type DuplicateMealPlanInput } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { createAddToQueryConnectionUpdater } from '#/apollo/utils/cacheUpdaters';

const addToMealPlans = createAddToQueryConnectionUpdater<{ id: string }>(
  'mealPlans',
  'MealPlan',
);

export function useDuplicateMealPlan() {
  const [duplicateMutation, { loading }] = useMutation(
    DuplicateMealPlanDocument,
    {
      update(cache, { data }) {
        const newPlan = data?.duplicateMealPlan?.mealPlan;
        if (newPlan) addToMealPlans(cache, newPlan);
      },
      onError: error => {
        toastService.error(error.message || 'Failed to duplicate meal plan');
      },
    },
  );

  const duplicatePlan = async (input: DuplicateMealPlanInput) => {
    const result = await executeMutation(
      () => duplicateMutation({ variables: { input } }),
      'Duplicate meal plan error:',
    );
    if (!result) return null;
    const data = result.data?.duplicateMealPlan;
    if (data?.success) {
      toastService.success('Meal plan duplicated!');
      Telemetry.trackEvent('meal_plan_duplicated', {
        meal_plan_id: input.mealPlanId,
      });
    }
    return data ?? null;
  };

  return {
    duplicatePlan,
    loading,
  };
}
