/**
 * A meal replay the server answered with a row other than the one it named: the
 * writes queued behind it move onto that row, and a delete of a meal the server
 * does not have is settled. The rest is `commit`.
 */
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import type { ReplayReconcilerTable } from '#/apollo/offlineQueue/types';
import { isRecord } from '#/utils/isRecord';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';

/**
 * A replayed recipe meal converges on the (plan, date, meal type, recipe) key,
 * so one added elsewhere returns under its own id, and queued writes follow it.
 */
export const reconcileCreateMealPlanItemReplay: ReplayReconcilerTable[string] =
  (_cache, variables, data, adopt) => {
    const input: unknown = variables.input;
    if (!isRecord(input) || typeof input.id !== 'string') return;
    const payload: unknown = extractMutationPayload(data);
    const item = isRecord(payload) ? payload.mealPlanItem : undefined;
    if (!isRecord(item) || typeof item.id !== 'string') return;
    if (item.id === input.id) return;
    // The surviving row's version: an edit queued behind the create stated the
    // minted row's, which the kept row is past.
    adopt?.({
      mintedId: input.id,
      survivingId: item.id,
      version: typeof item.version === 'number' ? item.version : undefined,
    });
  };

/** A delete of a meal the server does not have: only its record goes. */
export const settleGoneMealPlanItem: ReplayReconcilerTable[string] = (
  cache,
  variables,
) => {
  const input: unknown = variables.input;
  if (isRecord(input) && typeof input.id === 'string') {
    safeEvict(cache, 'MealPlanItem', input.id);
  }
};
