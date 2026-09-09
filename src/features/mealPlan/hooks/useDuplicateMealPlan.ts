import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreateMealPlanItemDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import {
  UseDuplicateMealPlan_MealPlanFragmentDoc,
  type UseDuplicateMealPlan_MealPlanFragment,
} from '#features/mealPlan/hooks/useDuplicateMealPlan.generated';
import {
  duplicatePlan,
  type SourcePlan,
} from '#features/mealPlan/utils/duplicatePlan';
import { useMealPlanActions } from '#features/mealPlan/hooks/useMealPlanActions';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { errorService } from '#/services/errorService';
import { t } from '#/i18n';

export interface DuplicateMealPlanOptions {
  mealPlanId: string;
  newName: string;
  newStartDate: string;
  newEndDate: string;
}

/**
 * Recreates the plan from the cache as a create plus one create per meal, so it
 * works offline. Every write carries a client-minted id, so a replay converges
 * on the same rows rather than making a second copy.
 */
export function useDuplicateMealPlan() {
  const client = useApolloClient();
  const { createMealPlan, creating } = useMealPlanActions();
  const [createItem, { loading: addingItems }] = useMutation(
    CreateMealPlanItemDocument,
  );

  const readSource = (mealPlanId: string): SourcePlan | null => {
    const cacheId = client.cache.identify({
      __typename: 'MealPlan',
      id: mealPlanId,
    });
    if (!cacheId) return null;
    return client.cache.readFragment<UseDuplicateMealPlan_MealPlanFragment>({
      id: cacheId,
      fragment: UseDuplicateMealPlan_MealPlanFragmentDoc,
      fragmentName: 'useDuplicateMealPlan_mealPlan',
    });
  };

  const duplicate = async (options: DuplicateMealPlanOptions) => {
    const source = readSource(options.mealPlanId);
    if (!source) {
      toastService.error(t('duplicatePlan.needsThePlan'));
      return null;
    }

    const derived = duplicatePlan(source, options);
    if (derived === 'duration-differs') {
      toastService.error(t('duplicatePlan.durationDiffers'));
      return null;
    }

    const created = await createMealPlan(derived.plan);
    // A refusal has already been reported and the optimistic plan reverted;
    // queued resolves null too, which is why the minted id is what we go on.
    if (created?.__typename === 'ValidationError') return null;

    for (const item of derived.items) {
      try {
        await createItem({
          variables: { input: item },
          context: { localFirst: true },
        });
      } catch (error) {
        errorService.reportError(error, { operation: 'Duplicate meal plan' });
      }
    }

    toastService.success(t('toasts.mealPlanDuplicated'));
    if (derived.skipped.length > 0) {
      toastService.info(
        t('duplicatePlan.someSkipped', {
          count: derived.skipped.length,
        }),
      );
    }
    Telemetry.trackEvent('meal_plan_duplicated', {
      meal_plan_id: options.mealPlanId,
      copied_meals: derived.items.length,
      skipped_meals: derived.skipped.length,
    });

    return {
      mealPlanId: derived.plan.id ?? null,
      mealCount: derived.items.length,
    };
  };

  return {
    duplicatePlan: duplicate,
    loading: creating || addingItems,
  };
}
