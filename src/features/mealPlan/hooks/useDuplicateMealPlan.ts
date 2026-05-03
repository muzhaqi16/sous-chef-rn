import {
  useDuplicateMealPlanMutation,
  GetMealPlansDocument,
  type DuplicateMealPlanInput,
} from '#generated';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { executeMutation } from '#/utils/compilerSafeWrappers';

export function useDuplicateMealPlan() {
  const [duplicateMutation, { loading }] = useDuplicateMealPlanMutation({
    refetchQueries: [{ query: GetMealPlansDocument }],
    onError: error => {
      toastService.error(error.message || 'Failed to duplicate meal plan');
    },
  });

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
