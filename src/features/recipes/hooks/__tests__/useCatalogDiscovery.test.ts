import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { memoryScreen } from '#/test-utils/memoryPlatform';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  Diet,
  ExternalSource,
  Intolerance,
} from '#/graphql/generated/schemaTypes';
import { getI18n } from '#/i18n/config';
import { toDisplayItems } from '#features/recipes/screens/recipeDisplayItems';
import type { RecipeRow } from '#features/recipes/utils/recipeRows';
import {
  useCatalogDiscovery,
  type DiscoveryDiet,
} from '../useCatalogDiscovery';
import {
  CatalogRecipesByIngredientsDocument,
  RandomCatalogRecipesDocument,
  type CatalogRecipesByIngredientsQuery,
  type RandomCatalogRecipesQuery,
} from '../useCatalogDiscovery.generated';

// The rows as the list shows them, in the copy of en.json.
const shown = (rows: RecipeRow[]) => toDisplayItems(rows, getI18n().t);

const mockUseCurrentHome = jest.fn();
jest.mock('#features/pantry/hooks/useCurrentHome', () => ({
  useCurrentHome: () => mockUseCurrentHome(),
}));

const mockUsePantryManagement = jest.fn();
jest.mock('#features/pantry/hooks/usePantryManagement', () => ({
  usePantryManagement: (...args: unknown[]) => mockUsePantryManagement(...args),
}));

const DIET: DiscoveryDiet = {
  diets: [Diet.Vegan],
  intolerances: [Intolerance.Dairy],
};

// The hook gates its pantry watch on screen focus; the memory screen drives it.
const focus = () => {
  act(() => memoryScreen().setFocused(true));
};
const blur = () => {
  act(() => memoryScreen().setFocused(false));
};

// `hasResult` without `loading` is a pantry that answered and is now
// refetching or loading another page.
const pantryHolding = (
  names: string[],
  {
    loading = false,
    hasResult = !loading,
  }: { loading?: boolean; hasResult?: boolean } = {},
) => {
  mockUsePantryManagement.mockReturnValue({
    state: {
      items: names.map((itemName, index) => ({ id: `p${index}`, itemName })),
      loading,
      hasResult,
      hasMore: false,
      isLoadingMore: false,
    },
    actions: { loadMore: jest.fn() },
  });
};

type MatchEdge = NonNullable<
  NonNullable<
    MockDataFor<
      typeof CatalogRecipesByIngredientsDocument
    >['catalogRecipesByIngredients']
  >['edges']
>[number];

type RandomEdge = NonNullable<
  NonNullable<
    MockDataFor<typeof RandomCatalogRecipesDocument>['randomCatalogRecipes']
  >['edges']
>[number];

const hit = (id: number, name = `Recipe ${id}`) => ({
  provider: ExternalSource.Spoonacular,
  providerRecipeId: String(id),
  name,
});

const matchEdge = (id: number, used = 2, missed = 1): MatchEdge => ({
  usedIngredientCount: used,
  missedIngredientCount: missed,
  node: hit(id),
});

const randomEdge = (id: number): RandomEdge => ({ node: hit(id) });

const byIngredientsMock = (edges: MatchEdge[]) =>
  recordMock(CatalogRecipesByIngredientsDocument, {
    data: { catalogRecipesByIngredients: { edges, catalogAvailable: true } },
  });

const randomMock = (edges: RandomEdge[]) =>
  recordMock(RandomCatalogRecipesDocument, {
    data: { randomCatalogRecipes: { edges, catalogAvailable: true } },
  });

const renderDiscovery = (
  operationMocks: MockedResponse[],
  options?: { enabled?: boolean },
  cache = makeCache(),
) =>
  renderHookWithApollo(() => useCatalogDiscovery(DIET, options), {
    operationMocks,
    cache,
  });

const ids = (count: number) =>
  Array.from({ length: count }, (_, index) => index + 1);

const hitNode = (id: number) => ({
  ...hit(id),
  imageUrl: null,
  servings: 4,
  totalTimeMinutes: null,
  likes: null,
});

const RANDOM_VARIABLES = {
  diets: [Diet.Vegan],
  intolerances: [Intolerance.Dairy],
  first: 25,
};

// What an earlier session left in the persisted cache.
const cachedRandomPage = (
  count: number,
  catalogAvailable = true,
): RandomCatalogRecipesQuery => ({
  __typename: 'Query',
  randomCatalogRecipes: {
    __typename: 'CatalogRecipeConnection',
    catalogAvailable,
    edges: ids(count).map(id => ({
      __typename: 'CatalogRecipeEdge',
      cursor: String(id),
      node: { __typename: 'CatalogRecipeHit', ...hitNode(id) },
    })),
  },
});

const cachedPantryPage = (
  count: number,
  catalogAvailable = true,
): CatalogRecipesByIngredientsQuery => ({
  __typename: 'Query',
  catalogRecipesByIngredients: {
    __typename: 'CatalogRecipeMatchConnection',
    catalogAvailable,
    edges: ids(count).map(id => ({
      __typename: 'CatalogRecipeMatchEdge',
      cursor: String(id),
      usedIngredientCount: 1,
      missedIngredientCount: 0,
      node: { __typename: 'CatalogRecipeHit', ...hitNode(id) },
    })),
  },
});

beforeEach(() => {
  memoryScreen().setFocused(true);
  mockUseCurrentHome.mockReturnValue({
    currentHome: {
      id: 'home-1',
      pantriesConnection: {
        edges: [{ node: { id: 'pantry-1', isDefault: true } }],
      },
    },
  });
  pantryHolding([]);
});

describe('useCatalogDiscovery', () => {
  it('asks for random catalog recipes, screened by the profile, for an empty pantry', async () => {
    const random = randomMock([randomEdge(1), randomEdge(2)]);
    const byIngredients = byIngredientsMock([]);
    const { result } = renderDiscovery([random.mock, byIngredients.mock]);

    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    expect(random.fired).toEqual([
      { diets: [Diet.Vegan], intolerances: [Intolerance.Dairy], first: 25 },
    ]);
    expect(byIngredients.fired).toEqual([]);
    expect(result.current.mode).toBe('random');
    expect(result.current.loading).toBe(false);
    expect(shown(result.current.rows)[0]).toMatchObject({
      title: 'Recipe 1',
      badge: { text: 'Suggested' },
      target: {
        catalog: {
          provider: ExternalSource.Spoonacular,
          externalId: '1',
          name: 'Recipe 1',
        },
      },
    });
  });

  it("asks for what the pantry's items make, naming at most 20 of them", async () => {
    const names = Array.from({ length: 25 }, (_, index) => `item ${index}`);
    pantryHolding(names);
    const byIngredients = byIngredientsMock([matchEdge(200, 2, 1)]);
    const random = randomMock([]);
    const { result } = renderDiscovery([byIngredients.mock, random.mock]);

    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    expect(byIngredients.fired).toEqual([
      { ingredients: names.slice(0, 20).sort(), first: 25 },
    ]);
    expect(random.fired).toEqual([]);
    expect(result.current.mode).toBe('pantry');
    expect(result.current.hasPantryItems).toBe(true);
    expect(shown(result.current.rows)[0]?.badge?.text).toBe(
      getI18n().t('recipes.pantryMatchLabel', {
        used: 2,
        count: 3,
        missing: 1,
      }),
    );
  });

  it('counts names the way the API does, so commas cannot push it past 20', async () => {
    pantryHolding([
      'Beans, black, canned',
      'Tomatoes, diced',
      ...Array.from({ length: 18 }, (_, index) => `item ${index}`),
    ]);
    const byIngredients = byIngredientsMock([matchEdge(1)]);
    const { result } = renderDiscovery([byIngredients.mock]);

    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    const [sent] = byIngredients.fired;
    const ingredients = (sent?.ingredients as string[] | undefined) ?? [];
    expect(ingredients).toHaveLength(20);
    expect(ingredients).toEqual(
      expect.arrayContaining(['beans', 'black', 'canned', 'tomatoes', 'diced']),
    );
    expect(ingredients).toEqual([...ingredients].sort());
  });

  it('names an item the pantry holds twice once', async () => {
    pantryHolding(['Milk', 'eggs', 'milk']);
    const byIngredients = byIngredientsMock([matchEdge(1)]);
    const { result } = renderDiscovery([byIngredients.mock]);

    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    expect(byIngredients.fired).toEqual([
      { ingredients: ['eggs', 'milk'], first: 25 },
    ]);
  });

  it('shows 15 recipes at a time', async () => {
    const { result } = renderDiscovery([
      randomMock(ids(25).map(randomEdge)).mock,
    ]);

    await waitFor(() => expect(result.current.rows).toHaveLength(15));
    expect(result.current.discoveryHasMore).toBe(true);

    act(() => result.current.loadMoreDiscovery());

    expect(result.current.rows).toHaveLength(25);
    expect(result.current.discoveryHasMore).toBe(false);
  });

  it('is loading while the pantry loads, and asks for nothing yet', () => {
    pantryHolding([], { loading: true });
    const random = randomMock([randomEdge(1)]);
    const byIngredients = byIngredientsMock([]);
    const { result } = renderDiscovery([random.mock, byIngredients.mock]);

    expect(result.current.loading).toBe(true);
    expect(result.current.mode).toBe('none');
    expect(random.fired).toEqual([]);
    expect(byIngredients.fired).toEqual([]);
  });

  it('is loading until the API answers', async () => {
    const random = recordMock(RandomCatalogRecipesDocument, {
      data: { randomCatalogRecipes: { edges: [randomEdge(1)] } },
      held: true,
    });
    const { result } = renderDiscovery([random.mock]);

    expect(result.current.loading).toBe(true);

    random.release();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toHaveLength(1);
  });

  it('shows nothing, and says it failed, when the API cannot answer', async () => {
    const random = recordMock(RandomCatalogRecipesDocument, {
      error: new Error('network down'),
    });
    const { result } = renderDiscovery([random.mock]);

    await waitFor(() => expect(random.fired).toHaveLength(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(result.current.discoveryHasMore).toBe(false);
    expect(result.current.failed).toBe(true);
  });

  it('says it failed when the catalog could not be asked and nothing came back', async () => {
    const random = recordMock(RandomCatalogRecipesDocument, {
      data: { randomCatalogRecipes: { edges: [], catalogAvailable: false } },
    });
    const { result } = renderDiscovery([random.mock]);

    await waitFor(() => expect(random.fired).toHaveLength(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.failed).toBe(true);
  });

  it('does not say it failed for an answer with no recipes in it', async () => {
    const random = randomMock([]);
    const { result } = renderDiscovery([random.mock]);

    await waitFor(() => expect(random.fired).toHaveLength(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.failed).toBe(false);
  });

  it('keeps its rows while the pantry refetches', async () => {
    pantryHolding(['tomato']);
    const byIngredients = byIngredientsMock([matchEdge(1)]);
    const { result, rerender } = renderDiscovery([byIngredients.mock]);
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    pantryHolding(['tomato'], { loading: true, hasResult: true });
    rerender({});

    expect(result.current.mode).toBe('pantry');
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.loading).toBe(false);
    expect(byIngredients.fired).toHaveLength(1);
  });

  it('shows the first screenful of a new list, even one as long as the last', async () => {
    const cache = makeCache();
    cache.writeQuery({
      query: RandomCatalogRecipesDocument,
      variables: RANDOM_VARIABLES,
      data: cachedRandomPage(25),
    });
    pantryHolding(['tomato']);
    const { result, rerender } = renderDiscovery(
      [byIngredientsMock(ids(25).map(id => matchEdge(id))).mock],
      undefined,
      cache,
    );
    await waitFor(() => expect(result.current.rows).toHaveLength(15));
    act(() => result.current.loadMoreDiscovery());
    expect(result.current.rows).toHaveLength(25);

    pantryHolding([]);
    rerender({});

    expect(result.current.mode).toBe('random');
    expect(result.current.rows).toHaveLength(15);
  });

  it('asks again for a page the cache holds from when the catalog was down', async () => {
    const cache = makeCache();
    cache.writeQuery({
      query: CatalogRecipesByIngredientsDocument,
      variables: { ingredients: ['tomato'], first: 25 },
      data: cachedPantryPage(0, false),
    });
    pantryHolding(['tomato']);
    const byIngredients = byIngredientsMock([matchEdge(1), matchEdge(2)]);
    const { result } = renderDiscovery([byIngredients.mock], undefined, cache);

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(byIngredients.fired).toHaveLength(1);
    expect(result.current.failed).toBe(false);
  });

  it('answers from the cache when it holds a whole page', async () => {
    const cache = makeCache();
    cache.writeQuery({
      query: CatalogRecipesByIngredientsDocument,
      variables: { ingredients: ['tomato'], first: 25 },
      data: cachedPantryPage(3),
    });
    pantryHolding(['tomato']);
    const byIngredients = byIngredientsMock([matchEdge(1)]);
    const { result } = renderDiscovery([byIngredients.mock], undefined, cache);

    await waitFor(() => expect(result.current.rows).toHaveLength(3));
    expect(byIngredients.fired).toEqual([]);
  });

  it('asks the API again on refresh', async () => {
    pantryHolding(['tomato']);
    const byIngredients = byIngredientsMock([matchEdge(1)]);
    const { result } = renderDiscovery([byIngredients.mock]);
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    await act(async () => {
      await result.current.refresh();
    });

    expect(byIngredients.fired).toHaveLength(2);
  });
});

describe('useCatalogDiscovery: switched off', () => {
  it('asks for no recipes, but the ingredient picker still sees the pantry', () => {
    pantryHolding(['tomato']);
    const byIngredients = byIngredientsMock([matchEdge(1)]);
    const random = randomMock([randomEdge(1)]);

    const { result } = renderDiscovery([byIngredients.mock, random.mock], {
      enabled: false,
    });

    expect(byIngredients.fired).toEqual([]);
    expect(random.fired).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.rows).toEqual([]);
    expect(result.current.pantryItems).toHaveLength(1);
    expect(mockUsePantryManagement).toHaveBeenCalled();
  });
});

describe('useCatalogDiscovery: focus gate on the pantry watch', () => {
  const pantryWatchArgs = (skip: boolean) => [
    'pantry-1',
    { skip, fetchPolicy: 'cache-first' },
  ];

  it('watches the pantry while focused and stands the watch down while blurred', () => {
    renderDiscovery([randomMock([]).mock]);
    expect(mockUsePantryManagement).toHaveBeenLastCalledWith(
      ...pantryWatchArgs(false),
    );

    focus();
    blur();
    expect(mockUsePantryManagement).toHaveBeenLastCalledWith(
      ...pantryWatchArgs(true),
    );

    focus();
    expect(mockUsePantryManagement).toHaveBeenLastCalledWith(
      ...pantryWatchArgs(false),
    );
  });

  it('does not ask again across a blur/focus cycle when the pantry is unchanged', async () => {
    // The Recipes tab stays mounted while hidden: a focus change alone must
    // not cost a request.
    pantryHolding(['tomato', 'pasta']);
    const byIngredients = byIngredientsMock([matchEdge(200)]);
    const { result } = renderDiscovery([byIngredients.mock]);
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    focus();
    blur();
    focus();
    await act(async () => {
      await Promise.resolve();
    });

    expect(byIngredients.fired).toHaveLength(1);
    expect(result.current.mode).toBe('pantry');
  });
});
