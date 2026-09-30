/**
 * Settling a meal plan replay: a create the server resolved onto a row it
 * already held, and a delete whose response names the removed row.
 */
import { adoptServerMealPlanItem } from '#features/mealPlan/cache/mealPlanItem';
import {
  removeFromMealPlans,
  removeFromMealTemplates,
} from '#features/mealPlan/cache/removals';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import type { ReplayReconcilerTable } from '#/apollo/offlineQueue/types';
import { isRecord } from '#/utils/isRecord';

/**
 * A replayed recipe meal converges on the (plan, date, meal type, recipe) key,
 * so a meal another device already added comes back under its own id; the
 * minted row is withdrawn and the server's linked, as the foreground does.
 */
export const reconcileCreateMealPlanItemReplay: ReplayReconcilerTable[string] =
  (cache, variables, data) => {
    const input: unknown = variables.input;
    if (!isRecord(input)) return;
    const { id: mintedId, mealPlanId } = input;
    if (typeof mintedId !== 'string' || typeof mealPlanId !== 'string') return;

    const payload: unknown = extractMutationPayload(data);
    const item = isRecord(payload) ? payload.mealPlanItem : undefined;
    if (!isRecord(item) || typeof item.id !== 'string') return;
    adoptServerMealPlanItem(cache, mealPlanId, item.id, mintedId);
  };

/** The id a delete's input names, or null. */
const deletedId = (variables: { input?: unknown }): string | null => {
  const { input } = variables;
  return isRecord(input) && typeof input.id === 'string' ? input.id : null;
};

/**
 * An applied delete answers with its row's `{ id }`, which re-creates the
 * evicted entity; removing it again keeps the list readable. Shared by the
 * foreground `update` and the replay, which runs only for an applied write.
 */
export const settleMealPlanDelete: ReplayReconcilerTable[string] = (
  cache,
  variables,
) => {
  const id = deletedId(variables);
  if (!id) return;
  removeFromMealPlans(cache, id, { evictItem: true });
};

/** {@link settleMealPlanDelete} for a meal template. */
export const settleMealTemplateDelete: ReplayReconcilerTable[string] = (
  cache,
  variables,
) => {
  const id = deletedId(variables);
  if (!id) return;
  removeFromMealTemplates(cache, id, { evictItem: true });
};
