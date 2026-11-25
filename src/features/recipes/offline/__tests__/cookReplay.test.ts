import type { ApolloCache } from '@apollo/client';
import { makeCache } from '#apollo/cache';
import type { ReplayContext } from '#apollo/offlineQueue/replayPreparation';
import { localFirstFragment } from '#apollo/utils/localFirstFields';
import { seedFragment } from '#/test-utils/apolloMockProvider';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { MarkRecipeAsCookedDocument } from '#features/recipes/graphql/recipe.generated';
import { withCurrentMealVersion } from '../cookReplay';

const queuedCook = (input: Record<string, unknown>) =>
  makeQueuedMutation({
    ...queuedMutationFor(MarkRecipeAsCookedDocument),
    variables: { input },
  });

const contextFor = (cache: ApolloCache): ReplayContext => ({
  cache,
  unitsRefreshed: false,
  unitIdForSymbol: () => Promise.resolve(undefined),
});

const holdingMealAt = (version: number) => {
  const cache = makeCache();
  seedFragment(cache, {
    id: cache.identify({ __typename: 'MealPlanItem', id: 'mpi-1' }),
    fragment: localFirstFragment('MealPlanItem', 'version'),
    data: { __typename: 'MealPlanItem', id: 'mpi-1', version },
  });
  return cache;
};

describe('a queued planned cook replays', () => {
  it('at the version the device now holds for its meal', async () => {
    const cook = queuedCook({
      id: 'log-1',
      mealPlanItemId: 'mpi-1',
      mealPlanItemVersion: 2,
    });

    const variables = await withCurrentMealVersion(
      cook,
      contextFor(holdingMealAt(5)),
    );

    expect(variables.input).toMatchObject({ mealPlanItemVersion: 5 });
  });

  it('as queued when the device no longer holds the meal', async () => {
    const cook = queuedCook({ mealPlanItemId: 'gone', mealPlanItemVersion: 2 });

    const variables = await withCurrentMealVersion(
      cook,
      contextFor(makeCache()),
    );

    expect(variables).toBe(cook.variables);
  });

  it('as queued when it cooks no planned meal', async () => {
    const cook = queuedCook({ id: 'log-1', recipeId: 'r-1' });

    const variables = await withCurrentMealVersion(
      cook,
      contextFor(holdingMealAt(5)),
    );

    expect(variables).toBe(cook.variables);
  });
});
