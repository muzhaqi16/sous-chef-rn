import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import {
  Diet,
  ExternalSource,
  Intolerance,
  MealType,
} from '#/graphql/generated/schemaTypes';
import { readRecipeRef } from '#features/mealPlan/cache/mealTemplateItem';
import { writeLocalMealPlanItem } from '#features/mealPlan/cache/mealPlanItem';
import { MealPlanItem_RowFragmentDoc } from '#features/mealPlan/cache/mealPlanItem.generated';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { errorService } from '#/services/errorService';
import type { FoundHit, FoundRecipe } from '#features/recipes/utils/recipeRows';
import { SearchRecipesDocument } from '../useRecipeSearch.generated';
import { useRecipeTextSearch } from '../useRecipeTextSearch';

const heldRecipe: FoundRecipe = {
  __typename: 'Recipe',
  version: 1,
  id: 'recipe-1',
  name: 'Pasta al Forno',
  imageUrl: 'https://cdn.example.com/forno.jpg',
  servings: 4,
  totalTimeMinutes: 25,
  diets: [Diet.Vegetarian, Diet.Vegan],
  freeOf: [],
  isSaved: false,
};

const catalogHit: FoundHit = {
  __typename: 'CatalogRecipeHit',
  provider: ExternalSource.Spoonacular,
  providerRecipeId: '716429',
  name: 'Pasta with Garlic',
  imageUrl: 'https://img.spoonacular.com/recipes/716429-556x370.jpg',
  servings: 2,
  totalTimeMinutes: null,
  diets: [Diet.Vegetarian, Diet.GlutenFree],
  freeOf: [Intolerance.Dairy],
  likes: 12,
};

// One member type per response: the mock completion pins a list's union
// members by path, so a mixed list completes as one type.
const searchMock = (
  nodes: ReadonlyArray<FoundRecipe> | ReadonlyArray<FoundHit>,
  options: {
    held?: boolean;
    match?: (vars: Record<string, unknown>) => boolean;
  } = {},
) =>
  recordMock(SearchRecipesDocument, {
    data: {
      findRecipes: {
        edges: nodes.map(node => ({ node })),
        catalogAvailable: true,
      },
    },
    ...options,
  });

const renderSearch = (operationMocks: MockedResponse[], cache = makeCache()) =>
  renderHookWithApollo(() => useRecipeTextSearch(), { operationMocks, cache });

const heldRecipes = (count: number): FoundRecipe[] =>
  Array.from({ length: count }, (_, index) => ({
    ...heldRecipe,
    id: `recipe-${index + 1}`,
    name: `Recipe ${index + 1}`,
  }));

const recipesKept = (cache: ReturnType<typeof makeCache>) =>
  Object.keys(cache.extract()).filter(key => key.startsWith('Recipe:'));

/** Searches "curry" over five held recipes and picks the second. */
const pickSecondOfFive = async () => {
  const cache = makeCache();
  const m = searchMock(heldRecipes(5));
  const { result } = renderSearch([m.mock], cache);
  act(() => result.current.search('curry'));
  await waitFor(() => expect(result.current.results).toHaveLength(5));
  const keptBeforePick = recipesKept(cache);

  let target: unknown;
  act(() => {
    target = result.current.pick(result.current.results[1]!);
  });
  return { cache, target, keptBeforePick };
};

describe('useRecipeTextSearch', () => {
  it('searches no shorter than three characters', () => {
    const m = searchMock([heldRecipe]);
    const { result } = renderSearch([m.mock]);

    act(() => result.current.search('ab'));

    expect(m.fired).toEqual([]);
    expect(result.current.results).toEqual([]);
    expect(result.current.searching).toBe(false);
  });

  it('asks the API for the first page of the trimmed query', async () => {
    const m = searchMock([heldRecipe]);
    const { result } = renderSearch([m.mock]);

    act(() => result.current.search('  pasta '));
    await waitFor(() => expect(result.current.searching).toBe(false));

    // The Recipes tab's first page, with no filters.
    expect(m.fired).toEqual([
      { query: 'pasta', filters: {}, first: 25, after: null },
    ]);
  });

  it('plans a held recipe by its id', async () => {
    const m = searchMock([heldRecipe]);
    const { result } = renderSearch([m.mock]);

    act(() => result.current.search('pasta'));
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    expect(result.current.results[0]).toEqual({
      key: 'recipe-recipe-1',
      title: 'Pasta al Forno',
      subtitle: '⏱ 25 min • 4 servings',
      imageUrl: 'https://cdn.example.com/forno.jpg',
      // Vegan wins over vegetarian.
      dietTags: ['vegan'],
      target: { recipeId: 'recipe-1' },
    });
  });

  it('tags a held recipe dairy-free as its catalog hit is tagged', async () => {
    const m = searchMock([
      { ...heldRecipe, diets: [], freeOf: [Intolerance.Dairy] },
    ]);
    const { result } = renderSearch([m.mock]);

    act(() => result.current.search('pasta'));
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    expect(result.current.results[0]?.dietTags).toEqual(['dairyFree']);
  });

  it('opens a catalog hit through the API by its provider and id', async () => {
    const m = searchMock([catalogHit]);
    const { result } = renderSearch([m.mock]);

    act(() => result.current.search('pasta'));
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    expect(result.current.results[0]).toEqual({
      key: 'catalog-SPOONACULAR-716429',
      title: 'Pasta with Garlic',
      subtitle: '2 servings',
      imageUrl: 'https://img.spoonacular.com/recipes/716429-556x370.jpg',
      dietTags: ['vegetarian', 'glutenFree', 'dairyFree'],
      target: {
        catalog: {
          provider: ExternalSource.Spoonacular,
          externalId: '716429',
          name: 'Pasta with Garlic',
          imageUrl: 'https://img.spoonacular.com/recipes/716429-556x370.jpg',
        },
      },
    });
  });

  it('keeps the API’s order', async () => {
    const second: FoundHit = {
      ...catalogHit,
      providerRecipeId: '1',
      name: 'Garlic Bread',
    };
    const m = searchMock([catalogHit, second]);
    const { result } = renderSearch([m.mock]);

    act(() => result.current.search('garlic'));
    await waitFor(() => expect(result.current.results).toHaveLength(2));

    expect(result.current.results.map(item => item.title)).toEqual([
      'Pasta with Garlic',
      'Garlic Bread',
    ]);
  });

  it('clears results', async () => {
    const m = searchMock([heldRecipe]);
    const { result } = renderSearch([m.mock]);
    act(() => result.current.search('pasta'));
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    act(() => result.current.clear());

    expect(result.current.results).toEqual([]);
    expect(result.current.searching).toBe(false);
  });

  it('shows the newer query when an older one answers last', async () => {
    const older = searchMock([heldRecipe], {
      held: true,
      match: vars => vars.query === 'pasta',
    });
    const newer = searchMock([catalogHit], {
      match: vars => vars.query === 'garlic',
    });
    const { result } = renderSearch([older.mock, newer.mock]);

    act(() => result.current.search('pasta'));
    act(() => result.current.search('garlic'));
    await waitFor(() => expect(result.current.searching).toBe(false));
    expect(result.current.results.map(item => item.title)).toEqual([
      'Pasta with Garlic',
    ]);

    await act(async () => {
      older.release();
      await Promise.resolve();
    });

    expect(result.current.results.map(item => item.title)).toEqual([
      'Pasta with Garlic',
    ]);
  });

  it('leaves the results empty, and reports it, when the search fails', async () => {
    const report = jest
      .spyOn(errorService, 'reportError')
      .mockImplementation(() => undefined);
    const m = recordMock(SearchRecipesDocument, {
      error: new Error('network down'),
    });
    const { result } = renderSearch([m.mock]);

    act(() => result.current.search('pasta'));
    await waitFor(() => expect(m.fired).toHaveLength(1));
    await waitFor(() => expect(result.current.searching).toBe(false));

    expect(result.current.results).toEqual([]);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(expect.anything(), {
      operation: 'pickerRecipeSearch',
    });
    report.mockRestore();
  });
});

describe('useRecipeTextSearch: picking', () => {
  it('keeps the recipe it picks and none of the others', async () => {
    const { cache, target, keptBeforePick } = await pickSecondOfFive();

    expect(keptBeforePick).toEqual([]);
    expect(target).toEqual({ recipeId: 'recipe-2' });
    expect(recipesKept(cache)).toEqual(['Recipe:recipe-2']);
  });

  it('names a picked recipe the user never saved in a template draft', async () => {
    const { cache } = await pickSecondOfFive();

    expect(readRecipeRef(cache, 'recipe-2')?.name).toBe('Recipe 2');
  });

  it('names a picked recipe on the meal planned with it before the server answers', async () => {
    const { cache } = await pickSecondOfFive();
    expect(isHeld(cache, { __typename: 'Recipe', id: 'recipe-2' })).toBe(true);

    writeLocalMealPlanItem(cache, {
      id: 'meal-1',
      mealPlanId: 'plan-1',
      date: '2026-10-20',
      mealType: MealType.Dinner,
      meal: { recipeId: 'recipe-2' },
    });

    expect(
      cache.readFragment({
        id: 'MealPlanItem:meal-1',
        fragment: MealPlanItem_RowFragmentDoc,
        fragmentName: 'mealPlanItem_row',
      })?.recipe,
    ).toMatchObject({
      name: 'Recipe 2',
      imageUrl: 'https://cdn.example.com/forno.jpg',
    });
  });

  it('keeps nothing for a catalog hit, which opens through the API', async () => {
    const cache = makeCache();
    const m = searchMock([catalogHit]);
    const { result } = renderSearch([m.mock], cache);
    act(() => result.current.search('pasta'));
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    let target: unknown;
    act(() => {
      target = result.current.pick(result.current.results[0]!);
    });

    expect(target).toEqual({ catalog: expect.any(Object) });
    expect(
      Object.keys(cache.extract()).filter(key => key !== 'ROOT_QUERY'),
    ).toEqual([]);
  });
});
