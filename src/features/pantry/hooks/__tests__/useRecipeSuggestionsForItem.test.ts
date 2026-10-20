import { waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import { useRecipeSuggestionsForItem } from '../useRecipeSuggestionsForItem';
import {
  CatalogRecipesForItemDocument,
  type CatalogRecipesForItemQuery,
} from '../useRecipeSuggestionsForItem.generated';

type Edge = NonNullable<
  NonNullable<
    MockDataFor<
      typeof CatalogRecipesForItemDocument
    >['catalogRecipesByIngredients']
  >['edges']
>[number];

const edge = (id: string, name: string): Edge => ({
  node: { provider: ExternalSource.Spoonacular, providerRecipeId: id, name },
});

const suggestionsMock = (edges: Edge[]) =>
  recordMock(CatalogRecipesForItemDocument, {
    data: { catalogRecipesByIngredients: { edges, catalogAvailable: true } },
  });

const renderSuggestions = (
  itemName: string | undefined,
  operationMocks: MockedResponse[],
  cache = makeCache(),
) =>
  renderHookWithApollo(() => useRecipeSuggestionsForItem(itemName), {
    operationMocks,
    cache,
  });

// What an earlier visit left in the persisted cache for "milk".
const cacheHoldingMilk = (
  names: string[],
  catalogAvailable: boolean,
): ReturnType<typeof makeCache> => {
  const cache = makeCache();
  const data: CatalogRecipesForItemQuery = {
    __typename: 'Query',
    catalogRecipesByIngredients: {
      __typename: 'CatalogRecipeMatchConnection',
      catalogAvailable,
      edges: names.map((name, index) => ({
        __typename: 'CatalogRecipeMatchEdge',
        cursor: String(index),
        node: {
          __typename: 'CatalogRecipeHit',
          provider: ExternalSource.Spoonacular,
          providerRecipeId: `cached-${index}`,
          name,
          imageUrl: null,
          totalTimeMinutes: null,
          servings: 2,
        },
      })),
    },
  };
  cache.writeQuery({
    query: CatalogRecipesForItemDocument,
    variables: { ingredients: ['milk'], first: 5 },
    data,
  });
  return cache;
};

describe('useRecipeSuggestionsForItem', () => {
  it('lists catalog recipes that use the item, five at most', async () => {
    const suggestions = suggestionsMock([
      edge('1', 'Tomato soup'),
      edge('2', 'Bruschetta'),
    ]);
    const { result } = renderSuggestions('tomatoes', [suggestions.mock]);

    await waitFor(() =>
      expect(result.current.suggestedRecipes).toHaveLength(2),
    );

    expect(suggestions.fired).toEqual([
      { ingredients: ['tomatoes'], first: 5 },
    ]);
    expect(result.current.suggestedRecipes.map(r => r.name)).toEqual([
      'Tomato soup',
      'Bruschetta',
    ]);
    expect(result.current.loadingRecipes).toBe(false);
  });

  it('asks for nothing, and suggests nothing, without an item name', () => {
    const suggestions = suggestionsMock([edge('1', 'Tomato soup')]);
    const { result } = renderSuggestions(undefined, [suggestions.mock]);

    expect(suggestions.fired).toEqual([]);
    expect(result.current.suggestedRecipes).toEqual([]);
    expect(result.current.loadingRecipes).toBe(false);
  });

  it('asks about the name as the API reads it', async () => {
    const suggestions = suggestionsMock([edge('1', 'Bean salad')]);
    const { result } = renderSuggestions('  Beans, Black ', [suggestions.mock]);

    await waitFor(() =>
      expect(result.current.suggestedRecipes).toHaveLength(1),
    );
    expect(suggestions.fired).toEqual([
      { ingredients: ['beans', 'black'], first: 5 },
    ]);
  });

  it('asks for nothing for a name longer than the API takes', () => {
    const suggestions = suggestionsMock([edge('1', 'Tomato soup')]);
    const { result } = renderSuggestions('a'.repeat(150), [suggestions.mock]);

    expect(suggestions.fired).toEqual([]);
    expect(result.current.suggestedRecipes).toEqual([]);
    expect(result.current.loadingRecipes).toBe(false);
  });

  it('asks again for suggestions cached while the catalog was down', async () => {
    const suggestions = suggestionsMock([edge('1', 'Milkshake')]);
    const { result } = renderSuggestions(
      'milk',
      [suggestions.mock],
      cacheHoldingMilk([], false),
    );

    await waitFor(() =>
      expect(result.current.suggestedRecipes.map(r => r.name)).toEqual([
        'Milkshake',
      ]),
    );
    expect(suggestions.fired).toHaveLength(1);
  });

  it('answers from the cache when it holds a whole answer', async () => {
    const suggestions = suggestionsMock([edge('1', 'Milkshake')]);
    const { result } = renderSuggestions(
      'milk',
      [suggestions.mock],
      cacheHoldingMilk(['Rice pudding'], true),
    );

    await waitFor(() =>
      expect(result.current.suggestedRecipes.map(r => r.name)).toEqual([
        'Rice pudding',
      ]),
    );
    expect(suggestions.fired).toEqual([]);
  });

  it('is loading only until the API answers', async () => {
    const suggestions = recordMock(CatalogRecipesForItemDocument, {
      data: { catalogRecipesByIngredients: { edges: [edge('1', 'Soup')] } },
      held: true,
    });
    const { result } = renderSuggestions('tomatoes', [suggestions.mock]);

    expect(result.current.loadingRecipes).toBe(true);

    suggestions.release();
    await waitFor(() => expect(result.current.loadingRecipes).toBe(false));
    expect(result.current.suggestedRecipes).toHaveLength(1);
  });

  it('suggests nothing when the API cannot answer', async () => {
    const suggestions = recordMock(CatalogRecipesForItemDocument, {
      error: new Error('network down'),
    });
    const { result } = renderSuggestions('tomatoes', [suggestions.mock]);

    await waitFor(() => expect(suggestions.fired).toHaveLength(1));
    await waitFor(() => expect(result.current.loadingRecipes).toBe(false));
    expect(result.current.suggestedRecipes).toEqual([]);
  });
});
