import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  type MockedResponse,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import {
  catalogFetchKey,
  recordCatalogFetch,
} from '#features/recipes/store/catalogFetchTimes';
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

const DAY_MS = 24 * 60 * 60 * 1000;

// When the cached answer for "milk" arrived.
const milkFetched = (msAgo: number) => {
  recordCatalogFetch(
    catalogFetchKey('catalogRecipesByIngredients', {
      ingredients: ['milk'],
      first: 5,
    }),
    Date.now() - msAgo,
  );
};

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
  seedQuery(cache, {
    query: CatalogRecipesForItemDocument,
    variables: { ingredients: ['milk'], first: 5 },
    data,
  });
  return cache;
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useRecipeSuggestionsForItem', () => {
  it('lists catalog recipes that use the item, five at most', async () => {
    const suggestions = suggestionsMock([
      edge('1', 'Tomato soup'),
      edge('2', 'Bruschetta'),
    ]);
    const { result } = renderSuggestions('tomatoes', [suggestions.mock]);

    await drainTimers();
    expect(result.current.suggestedRecipes).toHaveLength(2);

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

    await drainTimers();
    expect(result.current.suggestedRecipes).toHaveLength(1);
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

    await drainTimers();
    expect(result.current.suggestedRecipes.map(r => r.name)).toEqual([
      'Milkshake',
    ]);
    expect(suggestions.fired).toHaveLength(1);
  });

  it('answers from the cache when it holds a whole answer', async () => {
    const suggestions = suggestionsMock([edge('1', 'Milkshake')]);
    const { result } = renderSuggestions(
      'milk',
      [suggestions.mock],
      cacheHoldingMilk(['Rice pudding'], true),
    );

    await drainTimers();
    expect(result.current.suggestedRecipes.map(r => r.name)).toEqual([
      'Rice pudding',
    ]);
    expect(suggestions.fired).toEqual([]);
  });

  it('shows suggestions fetched eight days ago while it asks for fresh ones', async () => {
    const cache = cacheHoldingMilk(['Rice pudding'], true);
    milkFetched(8 * DAY_MS);
    const suggestions = recordMock(CatalogRecipesForItemDocument, {
      data: {
        catalogRecipesByIngredients: {
          edges: [edge('1', 'Milkshake')],
          catalogAvailable: true,
        },
      },
      held: true,
    });
    const { result } = renderSuggestions('milk', [suggestions.mock], cache);

    expect(result.current.suggestedRecipes.map(r => r.name)).toEqual([
      'Rice pudding',
    ]);
    expect(result.current.loadingRecipes).toBe(false);
    await drainTimers();
    expect(suggestions.fired).toHaveLength(1);

    suggestions.release();
    await drainTimers();
    expect(result.current.suggestedRecipes.map(r => r.name)).toEqual([
      'Milkshake',
    ]);
  });

  it('answers from the cache for suggestions fetched yesterday', async () => {
    const cache = cacheHoldingMilk(['Rice pudding'], true);
    milkFetched(DAY_MS);
    const suggestions = suggestionsMock([edge('1', 'Milkshake')]);
    const { result } = renderSuggestions('milk', [suggestions.mock], cache);

    await drainTimers();
    expect(result.current.suggestedRecipes.map(r => r.name)).toEqual([
      'Rice pudding',
    ]);
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
    await drainTimers();
    expect(result.current.loadingRecipes).toBe(false);
    expect(result.current.suggestedRecipes).toHaveLength(1);
  });

  it('suggests nothing when the API cannot answer', async () => {
    const suggestions = recordMock(CatalogRecipesForItemDocument, {
      error: new Error('network down'),
    });
    const { result } = renderSuggestions('tomatoes', [suggestions.mock]);

    await drainTimers();
    expect(suggestions.fired).toHaveLength(1);
    await drainTimers();
    expect(result.current.loadingRecipes).toBe(false);
    expect(result.current.suggestedRecipes).toEqual([]);
  });
});
