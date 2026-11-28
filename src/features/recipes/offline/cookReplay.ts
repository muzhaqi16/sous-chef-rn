import type { ReplayPreparer } from '#apollo/offlineQueue/replayPreparation';
import { readVersion } from '#apollo/utils/entityWriteChain';
import { isRecord } from '#utils/isRecord';

/**
 * A queued cook of a planned meal replays against the meal as the device now
 * holds it. The cook changes only the meal's completion, which the server
 * refuses on its own once another cook took it, so another member's edit to
 * the meal since never strands it.
 */
export const withCurrentMealVersion: ReplayPreparer = (mutation, { cache }) => {
  const { variables } = mutation;
  const input: unknown = variables.input;
  if (!isRecord(input) || typeof input.mealPlanItemId !== 'string') {
    return Promise.resolve(variables);
  }
  const version = readVersion(cache, {
    __typename: 'MealPlanItem',
    id: input.mealPlanItemId,
  });
  return Promise.resolve(
    version === undefined
      ? variables
      : { ...variables, input: { ...input, mealPlanItemVersion: version } },
  );
};
