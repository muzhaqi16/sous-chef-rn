import { makeCache } from '#/apollo/cache';
import type { CreateRecipeInput } from '#/graphql/generated/schemaTypes';
import { writeLocalRecipe } from '../recipeCacheWriters';
import { RecipeCacheWriters_RowFragmentDoc } from '../recipeCacheWriters.generated';

const INPUT: CreateRecipeInput = {
  id: 'client-recipe-1',
  name: 'Offline Stew',
  instructions: [{ step: 1, text: 'Simmer' }],
  ingredients: [{ name: 'Onion', quantity: 1 }],
};

const readRow = (cache: ReturnType<typeof makeCache>) =>
  cache.readFragment({
    id: cache.identify({ __typename: 'Recipe', id: 'client-recipe-1' }),
    fragment: RecipeCacheWriters_RowFragmentDoc,
    fragmentName: 'recipeCacheWriters_row',
  });

describe('writeLocalRecipe', () => {
  it('states the per-serving calories the server derives from the create', () => {
    const cache = makeCache();
    writeLocalRecipe(
      cache,
      'client-recipe-1',
      { ...INPUT, nutrition: { caloriesPerServing: 420 } },
      null,
    );

    expect(readRow(cache)?.nutritionPerServing).toEqual({
      __typename: 'RecipeNutrition',
      calories: 420,
      dietaryFiber: null,
      protein: null,
      sodium: null,
      totalCarbs: null,
      totalFat: null,
      totalSugars: null,
    });
  });

  it('states no nutrition for a create without calories', () => {
    const cache = makeCache();
    writeLocalRecipe(cache, 'client-recipe-1', INPUT, null);

    expect(readRow(cache)?.nutritionPerServing).toBeNull();
  });
});
