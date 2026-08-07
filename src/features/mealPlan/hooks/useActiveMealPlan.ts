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
 * Resolve which meal plan the screen shows, and load it.
 *
 * Selection priority is the user's explicit pick, then the current plan, then
 * the first plan in the overview — minus any id this session has learned the
 * server won't serve.
 *
 * That subtraction is what keeps the screen from wedging. `selectedMealPlanId`
 * is persisted, and nothing clears it when the plan disappears from under the
 * user: a plan deleted on another device, or a home membership revoked, leaves
 * a stale id that the priority above would keep choosing forever, with its
 * detail read failing every time. Two server answers say that id is finished,
 * and they are different conditions:
 *
 * - **null data** (`planNotFound`) — there is no such row. A by-id query
 *   reports a miss this way, not as an error.
 * - **FORBIDDEN** — the row is there and is not this user's.
 *
 * Either one drops the persisted pick, excludes the id from re-selection, and
 * evicts the cached entity so a cold-start hydrate can't resurrect it.
 *
 * Reading null as "gone" is only sound because `useMealPlan` skips the query
 * for a create the server hasn't acknowledged. Under offline-first, null on a
 * client-minted id is the routine "my create hasn't synced yet" state — the
 * queued mutation still owns that row, and evicting it here would delete work
 * the user is waiting on.
 *
 * Otherwise deliberately narrow: only a definitive answer about that id counts.
 * Network errors leave the selection alone, so going offline never looks like a
 * deletion. An id absent from `planIds` doesn't count either — the overview is
 * one page of 20, so absence there is not evidence of anything.
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
