import { act } from '@testing-library/react-native';
import { CombinedGraphQLErrors } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { useStore } from '#store';
import {
  Diet,
  ExternalSource,
  Intolerance,
  RecipeCategory,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import { DEFAULT_FILTERS } from '#features/recipes/utils/recipeFilterOptions';
import { useRecipeSearch, type SearchOutcome } from '../useRecipeSearch';
import { SearchRecipesDocument } from '../useRecipeSearch.generated';
import { CatalogRecipesByIngredientsDocument } from '../useCatalogDiscovery.generated';

type Found = NonNullable<
  MockDataFor<typeof SearchRecipesDocument>['findRecipes']
>;
type FoundEdge = NonNullable<NonNullable<Found['edges']>[number]>;

const held = (id: string, name: string): FoundEdge => ({
  cursor: `c-${id}`,
  node: { __typename: 'Recipe', id, name },
});

const hit = (providerRecipeId: string, name: string): FoundEdge => ({
  cursor: `c-${providerRecipeId}`,
  node: {
    __typename: 'CatalogRecipeHit',
    provider: ExternalSource.Spoonacular,
    providerRecipeId,
    name,
  },
});

const page = (
  edges: FoundEdge[],
  {
    endCursor = null,
    hasNextPage = false,
    catalogAvailable = true,
  }: {
    endCursor?: string | null;
    hasNextPage?: boolean;
    catalogAvailable?: boolean;
  } = {},
): MockDataFor<typeof SearchRecipesDocument> => ({
  findRecipes: {
    edges,
    pageInfo: { endCursor, hasNextPage },
    catalogAvailable,
  },
});

const renderSearch = (operationMocks: MockedResponse[]) =>
  renderHookWithApollo(() => useRecipeSearch(), { operationMocks });

const rateLimited = () =>
  new CombinedGraphQLErrors({
    errors: [
      {
        message: 'limited',
        extensions: { code: TopLevelErrorCode.RateLimitExceeded },
      },
    ],
  });

beforeEach(() => {
  useStore.setState({ isOnline: true, apiReachable: true });
});

describe('useRecipeSearch', () => {
  it('lists held recipes and catalog hits in the order the API gives them', async () => {
    const search = recordMock(SearchRecipesDocument, {
      data: page([
        held('r-1', 'Lentil stew'),
        hit('716429', 'Lentil soup'),
        held('r-2', 'Red lentil dal'),
        hit('8001', 'Lentil salad'),
      ]),
    });
    const { result } = renderSearch([search.mock]);

    let outcome: SearchOutcome | undefined;
    await act(async () => {
      outcome = await result.current.search('lentil', DEFAULT_FILTERS);
    });
    expect(outcome).toEqual({ status: 'shown', partial: false });
    expect(search.fired).toEqual([
      { query: 'lentil', filters: {}, first: 25, after: null },
    ]);
    expect(
      result.current.rows.map(row =>
        row.source === 'recipe'
          ? `recipe ${row.recipe.id}`
          : row.source === 'catalog'
          ? `catalog ${row.hit.providerRecipeId}`
          : row.source,
      ),
    ).toEqual(['recipe r-1', 'catalog 716429', 'recipe r-2', 'catalog 8001']);
    expect(result.current.query).toBe('lentil');
    expect(result.current.performed).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.hasMore).toBe(false);
  });

  it("sends the filters as the API's RecipeFilters", async () => {
    const search = recordMock(SearchRecipesDocument, { data: page([]) });
    const { result } = renderSearch([search.mock]);

    await act(async () => {
      await result.current.search('stew', {
        diet: [Diet.Vegan],
        intolerances: [Intolerance.Peanut],
        mealType: RecipeCategory.Dinner,
        maxReadyTime: 30,
      });
    });

    expect(search.fired[0]?.filters).toEqual({
      diets: [Diet.Vegan],
      intolerances: [Intolerance.Peanut],
      category: RecipeCategory.Dinner,
      maxReadyTime: 30,
    });
  });

  it('appends the next page from the cursor, and stops where the API does', async () => {
    const search = recordMock(SearchRecipesDocument, {
      dataFor: vars =>
        vars.after === 'cursor-1'
          ? page([hit('2', 'Second')])
          : page([held('r-1', 'First')], {
              endCursor: 'cursor-1',
              hasNextPage: true,
            }),
    });
    const { result } = renderSearch([search.mock]);

    await act(async () => {
      await result.current.search('stew', DEFAULT_FILTERS);
    });
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(search.fired[1]).toEqual({
      query: 'stew',
      filters: {},
      first: 25,
      after: 'cursor-1',
    });
    expect(result.current.rows.map(row => row.source)).toEqual([
      'recipe',
      'catalog',
    ]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.loadingMore).toBe(false);
  });

  it('reports a page the catalog could not answer as partial', async () => {
    const search = recordMock(SearchRecipesDocument, {
      data: page([held('r-1', 'Lentil stew')], { catalogAvailable: false }),
    });
    const { result } = renderSearch([search.mock]);

    let outcome: SearchOutcome | undefined;
    await act(async () => {
      outcome = await result.current.search('stew', DEFAULT_FILTERS);
    });

    expect(outcome).toEqual({ status: 'shown', partial: true });
    expect(result.current.rows).toHaveLength(1);
  });

  it('lets a newer search win over one still in flight', async () => {
    const older = recordMock(SearchRecipesDocument, {
      data: page([held('r-old', 'Old')]),
      match: vars => vars.query === 'old',
      held: true,
    });
    const newer = recordMock(SearchRecipesDocument, {
      data: page([held('r-new', 'New')]),
      match: vars => vars.query === 'new',
    });
    const { result } = renderSearch([older.mock, newer.mock]);

    let first: Promise<SearchOutcome> | undefined;
    act(() => {
      first = result.current.search('old', DEFAULT_FILTERS);
    });
    await act(async () => {
      await result.current.search('new', DEFAULT_FILTERS);
    });
    let outcome: SearchOutcome | undefined;
    await act(async () => {
      older.release();
      outcome = await first;
    });

    expect(outcome).toEqual({ status: 'superseded' });
    expect(result.current.query).toBe('new');
    expect(
      result.current.rows.map(row =>
        row.source === 'recipe' ? row.recipe.id : row.source,
      ),
    ).toEqual(['r-new']);
    expect(result.current.loading).toBe(false);
  });

  it('says offline, not failed, when the API cannot be reached', async () => {
    const search = recordMock(SearchRecipesDocument, {
      error: new Error('Network request failed'),
    });
    useStore.setState({ isOnline: false, apiReachable: false });
    const { result } = renderSearch([search.mock]);

    let outcome: SearchOutcome | undefined;
    await act(async () => {
      outcome = await result.current.search('stew', DEFAULT_FILTERS);
    });

    expect(outcome).toEqual({ status: 'failed', failure: 'offline' });
    expect(result.current.rows).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('tells a rate limit apart from any other failure', async () => {
    const search = recordMock(SearchRecipesDocument, { error: rateLimited() });
    const { result } = renderSearch([search.mock]);

    let outcome: SearchOutcome | undefined;
    await act(async () => {
      outcome = await result.current.search('stew', DEFAULT_FILTERS);
    });

    expect(outcome).toEqual({ status: 'failed', failure: 'rateLimited' });
  });

  it('reports any other failure as failed', async () => {
    const search = recordMock(SearchRecipesDocument, {
      error: new Error('boom'),
    });
    const { result } = renderSearch([search.mock]);

    let outcome: SearchOutcome | undefined;
    await act(async () => {
      outcome = await result.current.search('stew', DEFAULT_FILTERS);
    });

    expect(outcome).toEqual({ status: 'failed', failure: 'failed' });
  });

  it('keeps the rows it shows when a later page fails', async () => {
    const search = recordMock(SearchRecipesDocument, {
      dataFor: () =>
        page([held('r-1', 'First')], {
          endCursor: 'cursor-1',
          hasNextPage: true,
        }),
      match: vars => vars.after !== 'cursor-1',
    });
    const failing = recordMock(SearchRecipesDocument, {
      error: new Error('boom'),
      match: vars => vars.after === 'cursor-1',
    });
    const { result } = renderSearch([search.mock, failing.mock]);

    await act(async () => {
      await result.current.search('stew', DEFAULT_FILTERS);
    });
    await act(async () => {
      await result.current.loadMore();
    });

    expect(failing.fired).toHaveLength(1);
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.loadingMore).toBe(false);
  });

  it('searches by ingredients: one page of what they can make, no filters', async () => {
    const byIngredients = recordMock(CatalogRecipesByIngredientsDocument, {
      data: {
        catalogRecipesByIngredients: {
          edges: [
            {
              usedIngredientCount: 2,
              missedIngredientCount: 1,
              node: { providerRecipeId: '42', name: 'Tomato pasta' },
            },
          ],
          catalogAvailable: true,
        },
      },
    });
    const { result } = renderSearch([byIngredients.mock]);
    const names = Array.from({ length: 25 }, (_, i) => `item-${i}`);

    let outcome: SearchOutcome | undefined;
    await act(async () => {
      outcome = await result.current.searchByIngredients(names);
    });

    expect(outcome).toEqual({ status: 'shown', partial: false });
    expect(byIngredients.fired).toEqual([
      { ingredients: names.slice(0, 20), first: 25 },
    ]);
    const [row] = result.current.rows;
    expect(row?.source === 'pantry' && row.edge.usedIngredientCount).toBe(2);
    expect(result.current.query).toBe('');
    expect(result.current.hasMore).toBe(false);
  });

  it('drops a search cleared while in flight', async () => {
    const search = recordMock(SearchRecipesDocument, {
      data: page([held('r-1', 'Lentil stew')]),
      held: true,
    });
    const { result } = renderSearch([search.mock]);

    let pending: Promise<SearchOutcome> | undefined;
    act(() => {
      pending = result.current.search('stew', DEFAULT_FILTERS);
    });
    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.clear();
    });
    let outcome: SearchOutcome | undefined;
    await act(async () => {
      search.release();
      outcome = await pending;
    });

    expect(outcome).toEqual({ status: 'superseded' });
    expect(result.current.rows).toEqual([]);
    expect(result.current.performed).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.query).toBe('');
  });
});
