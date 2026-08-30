import { useEffect, useState } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { useAppStore } from '#store/useAppStore';
import { isResourceAccessLostError } from '#/utils/errors/graphqlErrors';
import { useMealPlan } from '#features/mealPlan/hooks/useMealPlan';

interface UseActiveMealPlanArgs {
  /** Plan the list hook considers current: active > nearest upcoming > latest. */
  currentPlanId: string | null;
  /** Every plan id the overview holds, in display order. */
  planIds: string[];
}

/**
 * Resolves which plan the screen shows: explicit pick, current plan, then the
 * first in the overview — minus ids this session learned are dead.
 * `selectedMealPlanId` is persisted and nothing else clears it, so without that
 * subtraction a plan deleted elsewhere wedges the screen forever.
 */

/*
 * Only null data (a by-id miss is not an error) and FORBIDDEN retire an id;
 * both drop the pick, exclude it and evict the entity. Null means "gone" only
 * because `useMealPlan` skips unacknowledged creates. A network error is not a
 * deletion, and `planIds` is one page of 20, so absence there is no evidence.
 */
export function useActiveMealPlan({
  currentPlanId,
  planIds,
}: UseActiveMealPlanArgs) {
  const client = useApolloClient();
  const selectedMealPlanId = useAppStore(s => s.selectedMealPlanId);
  const setSelectedMealPlanId = useAppStore(s => s.setSelectedMealPlanId);

  const [unavailablePlanIds, setUnavailablePlanIds] = useState<
    ReadonlySet<string>
  >(() => new Set());

  const activePlanId =
    [selectedMealPlanId, currentPlanId, ...planIds].find(
      (id): id is string => !!id && !unavailablePlanIds.has(id),
    ) ?? null;

  const plan = useMealPlan(activePlanId);

  // "Adjusting state during render" (not an effect) per project conventions:
  // the id is dead as of this render, so re-deriving `activePlanId` on the
  // immediate re-render is what stops the screen from showing it.
  if (
    activePlanId &&
    !unavailablePlanIds.has(activePlanId) &&
    (plan.planNotFound || isResourceAccessLostError(plan.error))
  ) {
    const goneId = activePlanId;
    setUnavailablePlanIds(prev => new Set(prev).add(goneId));
    if (selectedMealPlanId === goneId) {
      setSelectedMealPlanId(null);
    }
  }

  // Evict so the plan can't come back from the persisted cache on cold start.
  // Pure cache side-effect — no React state set here.
  useEffect(() => {
    if (unavailablePlanIds.size === 0) return;
    unavailablePlanIds.forEach(id => {
      client.cache.evict({
        id: client.cache.identify({ __typename: 'MealPlan', id }),
      });
    });
    client.cache.gc();
  }, [unavailablePlanIds, client]);

  return {
    activePlanId,
    ...plan,
  };
}
