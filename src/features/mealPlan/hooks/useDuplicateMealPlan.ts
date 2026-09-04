import { useMutation } from '@apollo/client/react';
import { DuplicateMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { type DuplicateMealPlanInput } from '#/graphql/generated/schemaTypes';
import { handleMutationError } from '#/utils/errorHandlers';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { createAddToQueryConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { useIsApiUnavailable } from '#features/mealPlan/hooks/useIsApiUnavailable';
import { t } from '#/i18n';
import { errorService } from '#/services/errorService';

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
    let result;
    try {
      result = await duplicateMutation({ variables: { input } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Duplicate meal plan error:',
      });
    }
    if (!result) return null;
    const data = result.data?.duplicateMealPlan;
    if (data?.__typename === 'DuplicateMealPlanPayload') {
      toastService.success(t('toasts.mealPlanDuplicated'));
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
