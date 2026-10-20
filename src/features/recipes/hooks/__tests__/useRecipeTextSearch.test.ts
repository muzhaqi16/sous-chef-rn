import { act, waitFor } from '@testing-library/react-native';
import {
  Diet,
  ExternalSource,
  Intolerance,
} from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import type { FoundHit, FoundRecipe } from '#features/recipes/utils/recipeRows';
import { SearchRecipesDocument } from '../useRecipeSearch.generated';
import { useRecipeTextSearch } from '../useRecipeTextSearch';

const heldRecipe: FoundRecipe = {
  __typename: 'Recipe',
  id: 'recipe-1',
  name: 'Pasta al Forno',
  imageUrl: 'https://cdn.example.com/forno.jpg',
  servings: 4,
  totalTimeMinutes: 25,
  diets: [Diet.Vegetarian, Diet.Vegan],
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

const renderSearch = (operationMocks: MockedResponse[]) =>
  renderHookWithApollo(() => useRecipeTextSearch(), { operationMocks });

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

    expect(m.fired).toEqual([{ query: 'pasta', first: 25 }]);
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
      // Vegan wins over vegetarian; a held recipe states no dairy-free.
      dietTags: ['vegan'],
      target: { recipeId: 'recipe-1' },
    });
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

  it('leaves the results empty when the search fails', async () => {
    const m = recordMock(SearchRecipesDocument, {
      error: new Error('network down'),
    });
    const { result } = renderSearch([m.mock]);

    act(() => result.current.search('pasta'));
    await waitFor(() => expect(m.fired).toHaveLength(1));
    await waitFor(() => expect(result.current.searching).toBe(false));

    expect(result.current.results).toEqual([]);
  });
});
