import { useMutation } from '@apollo/client/react';
import { DuplicateMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { type DuplicateMealPlanInput } from '#/graphql/generated/schemaTypes';
import { handleMutationError } from '#/utils/errorHandlers';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { createAddToQueryConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { t } from '#/i18n/t';

const addToMealPlans = createAddToQueryConnectionUpdater<{ id: string }>(
  'mealPlans',
  'MealPlan',
);

export function useDuplicateMealPlan() {
  const [duplicateMutation, { loading }] = useMutation(
    DuplicateMealPlanDocument,
    {
      update(cache, { data }) {
        const result = data?.duplicateMealPlan;
        if (result?.__typename === 'DuplicateMealPlanPayload') {
          addToMealPlans(cache, result.mealPlan);
        }
      },
      onError: error => {
        handleMutationError(error, { operation: 'Duplicate Meal Plan' });
      },
    },
  );

  const isApiUnavailable = useIsApiUnavailable();

  const duplicatePlan = async (input: DuplicateMealPlanInput) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return null;
    }
    const result = await executeMutation(
      () => duplicateMutation({ variables: { input } }),
      'Duplicate meal plan error:',
    );
    if (!result) return null;
    const data = result.data?.duplicateMealPlan;
    if (data?.__typename === 'DuplicateMealPlanPayload') {
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
    isApiUnavailable,
  };
}
