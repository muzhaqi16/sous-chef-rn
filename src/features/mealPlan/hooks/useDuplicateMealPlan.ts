import { useApolloClient } from '@apollo/client/react';
import { readPlanSource } from '#features/mealPlan/cache/derivationSources';
import { duplicatePlan } from '#features/mealPlan/utils/duplicatePlan';
import { useMealPlanActions } from '#features/mealPlan/hooks/useMealPlanActions';
import { useCreateMealPlanItem } from '#features/mealPlan/hooks/useCreateMealPlanItem';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import type { SettledFailure } from '#/apollo/utils/settleMutation';
import { t } from '#/i18n';

export interface DuplicateMealPlanOptions {
  mealPlanId: string;
  newName: string;
  /** The copy's first and last day, as `LocalDate` keys. */
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
  const { sendItem, creating: addingItems } = useCreateMealPlanItem();

  const duplicate = async (options: DuplicateMealPlanOptions) => {
    const source = readPlanSource(client.cache, options.mealPlanId);
    if (!source) {
      toastService.error(t('mealPlan.needsThePlan'));
      return null;
    }

    const derived = duplicatePlan(source, options);
    if (derived === 'duration-differs') {
      toastService.error(t('duplicatePlan.durationDiffers'));
      return null;
    }

    const created = await createMealPlan(derived.plan);
    // A failure has already been reported; a queued create has no server row
    // yet, which is why the minted id is used.
    if (created.status === 'failed') return null;

    const failures: SettledFailure[] = [];
    for (const item of derived.items) {
      const settled = await sendItem(item, 'none');
      if (settled.failure) failures.push(settled.failure);
    }

    // The plan exists either way, so a retry would copy it twice: report the
    // first failed meal once, in place of the success.
    const [failure] = failures;
    if (failure) {
      toastService.error(failure.body);
    } else {
      toastService.success(t('toasts.mealPlanDuplicated'));
    }
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
