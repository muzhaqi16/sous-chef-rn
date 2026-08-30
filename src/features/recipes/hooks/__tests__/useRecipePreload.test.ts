import { act } from '@testing-library/react-native';
import { ErrorCode, ExternalSource } from '#/graphql/generated/schemaTypes';
import { gql, InMemoryCache } from '@apollo/client';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import {
  renderHookWithApollo,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import {
  UpsertExternalRecipeDocument,
  AddRecipeToFavoritesDocument,
  MySavedRecipesDocument,
  type MySavedRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import type { RecipeInformation } from '#/services/recipeApi/types';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import { useRecipePreload, type PreloadedRecipe } from '../useRecipePreload';
import { makeCache } from '#/apollo/cache';

jest.mock('#/services/recipeApi/SpoonacularService', () => ({
  spoonacularService: { getRecipePriceBreakdown: jest.fn() },
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (
      ...args: Parameters<
        typeof import('#/services/toastService').toastService.success
      >
    ) => mockToastSuccess(...args),
    error: (
      ...args: Parameters<
        typeof import('#/services/toastService').toastService.error
      >
    ) => mockToastError(...args),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('#/utils/finallyHelpers');

// Deterministic client-minted SavedRecipe id so the optimistic-write/revert
// assertions can target a known cache key.
const SAVED_RECIPE_ID = 'client-saved-1';
jest.mock('#/utils/generateEntityId', () => ({
  generateEntityId: jest.fn(() => 'client-saved-1'),
}));

// Break circular dependency
jest.mock('#/apollo/links/tokenScheduler');

const makeSpoonacularRecipe = (id = 123) =>
  ({
    id,
    title: 'Test Recipe',
    summary: '<p>A tasty recipe</p>',
    servings: 4,
    preparationMinutes: 10,
    cookingMinutes: 20,
    image: 'https://example.com/img.jpg',
    sourceName: 'Test Source',
    sourceUrl: 'https://example.com/recipe',
    cuisines: ['Italian'],
    analyzedInstructions: [{ steps: [{ number: 1, step: 'Boil water' }] }],
    nutrition: {
      nutrients: [{ name: 'Calories', amount: 350 }],
      // Per-ingredient nutrition is included when the recipe is fetched with
      // includeNutrition: true — keyed by ingredient id (matches id 1 below).
      ingredients: [
        {
          id: 1,
          name: 'pasta',
          amount: 200,
          unit: 'g',
          nutrients: [
            {
              name: 'Calories',
              amount: 320,
              unit: 'kcal',
              percentOfDailyNeeds: 16,
            },
          ],
        },
      ],
    },
    extendedIngredients: [
      {
        name: 'pasta',
        amount: 200,
        original: '200g pasta',
        id: 1,
        aisle: 'Pasta',
        image: 'pasta.jpg',
        measures: {
          metric: { amount: 200, unitShort: 'g' },
          us: { amount: 7, unitShort: 'oz' },
        },
      },
    ],
  } as Partial<RecipeInformation> as RecipeInformation);

/**
 * Build a MockedResponse for UpsertExternalRecipe.
 *
 * The mutation's `input` variable is a transformed Spoonacular recipe with
 * many computed fields (cuisines.join, instructions reshape, etc.). We use a
 * `variableMatcher` instead of a literal `variables` block so we don't have
 * to reproduce the full transform inside each test.
 */
function buildUpsertMock(
  recipe: { id: string; name: string; imageUrl?: string | null },
  created: boolean = true,
): MockedResponse {
  return {
    request: {
      query: UpsertExternalRecipeDocument,
      variables: () => true,
    },
    result: {
      data: {
        upsertExternalRecipe: {
          __typename: 'UpsertExternalRecipePayload',
          created,
          recipe: {
            __typename: 'Recipe',
            id: recipe.id,
            name: recipe.name,
            imageUrl: recipe.imageUrl ?? null,
            externalSource: ExternalSource.Spoonacular,
            externalId: '123',
            servings: 4,
            prepTimeMinutes: 10,
            cookTimeMinutes: 20,
            totalTimeMinutes: 30,
          },
        },
      },
    },
  };
}

/**
 * recordMock for a successful UpsertExternalRecipe — returns `{ mock, fired }`
 * where `fired` captures the input variables Apollo observed. Use when a test
 * needs to assert on what the ingest sent.
 */
function recordUpsertMock() {
  return recordMock(UpsertExternalRecipeDocument, {
    data: {
      upsertExternalRecipe: {
        __typename: 'UpsertExternalRecipePayload',
        created: true,
        recipe: {
          __typename: 'Recipe',
          id: 'backend-1',
          name: 'Test Recipe',
          imageUrl: null,
          externalSource: ExternalSource.Spoonacular,
          externalId: '123',
          servings: 4,
          prepTimeMinutes: 10,
          cookTimeMinutes: 20,
          totalTimeMinutes: 30,
        },
      },
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useRecipePreload', () => {
  it('starts with default state', () => {
    const { result } = renderHookWithApollo(() => useRecipePreload());

    expect(result.current.preloading).toBe(false);
    expect(result.current.preloadedRecipe).toBeNull();
    expect(result.current.preloadError).toBeNull();
    expect(result.current.savingToFavorites).toBe(false);
  });

  it('preloadRecipe calls upsert mutation and caches result', async () => {
    const onPreloadSuccess = jest.fn();
    const { result } = renderHookWithApollo(
      () => useRecipePreload({ onPreloadSuccess }),
      {
        operationMocks: [
          buildUpsertMock(
            {
              id: 'backend-1',
              name: 'Test Recipe',
              imageUrl: 'https://example.com/img.jpg',
            },
            true,
          ),
        ],
      },
    );

    let preloaded!: PreloadedRecipe | null;
    await act(async () => {
      preloaded = await result.current.preloadRecipe(makeSpoonacularRecipe());
    });

    expect(preloaded).toEqual(
      expect.objectContaining({
        id: 'backend-1',
        name: 'Test Recipe',
        created: true,
        externalId: '123',
      }),
    );
    expect(onPreloadSuccess).toHaveBeenCalledWith(preloaded);
    expect(result.current.preloadedRecipe).toEqual(preloaded);
  });

  it('sanitizes a price baked into an ingredient name before sending to the API', async () => {
    // The API stores names verbatim (it does not strip prices), so the client
    // must never send a price baked into a name — even one that round-tripped in
    // from the backend. Regression guard for the "garlic $0.03" bug.
    const { mock, fired } = recordUpsertMock();

    const dirty = makeSpoonacularRecipe(777);
    dirty.extendedIngredients = [
      { ...dirty.extendedIngredients[0], name: 'pasta $1.50' },
    ];

    const { result } = renderHookWithApollo(() => useRecipePreload(), {
      operationMocks: [mock],
    });

    await act(async () => {
      await result.current.preloadRecipe(dirty);
    });

    expect(fired.length).toBeGreaterThan(0);
    const sent = fired[0] as {
      input: { ingredients: Array<{ name: string }> };
    };
    expect(sent.input.ingredients[0].name).toBe('pasta');
    expect(sent.input.ingredients.every(i => !/\$\s*\d/.test(i.name))).toBe(
      true,
    );
  });

  it('attaches a typed Spoonacular mirror payload per ingredient', async () => {
    // Single-call ingest: the client forwards the typed `externalSources`
    // payload so the API can mirror Spoonacular data and link the Item
    // asynchronously — no follow-up updateRecipeIngredients call.
    const { mock, fired } = recordUpsertMock();

    const { result } = renderHookWithApollo(() => useRecipePreload(), {
      operationMocks: [mock],
    });

    await act(async () => {
      await result.current.preloadRecipe(makeSpoonacularRecipe());
    });

    const sent = fired[0] as {
      input: {
        ingredients: Array<{
          name: string;
          externalSources: Array<{
            source: string;
            externalId: string;
            isPrimary: boolean;
            spoonacular: {
              id: number;
              name: string;
              image: string;
              aisle: string;
              measures: { us: { unitShort: string } };
              nutrition?: {
                nutrients: Array<{
                  name: string;
                  amount: number;
                  unit: string;
                  percentOfDailyNeeds: number;
                }>;
              };
            };
          }>;
        }>;
      };
    };
    const source = sent.input.ingredients[0].externalSources[0];
    expect(source).toEqual(
      expect.objectContaining({
        source: ExternalSource.Spoonacular,
        externalId: '1',
        isPrimary: true,
      }),
    );
    // Mirror carries the verbatim upstream name and the image FILENAME (no URL).
    expect(source.spoonacular).toEqual(
      expect.objectContaining({ id: 1, name: 'pasta', image: 'pasta.jpg' }),
    );
    expect(source.spoonacular.image).not.toMatch(/^https?:\/\//);
    expect(source.spoonacular.measures.us.unitShort).toBe('oz');
    // Per-ingredient nutrition joined from the recipe response (id 1) — no
    // extra Spoonacular call.
    expect(source.spoonacular.nutrition?.nutrients).toEqual([
      { name: 'Calories', amount: 320, unit: 'kcal', percentOfDailyNeeds: 16 },
    ]);
  });

  it('omits nutrition for an ingredient with no recipe-level match', async () => {
    const { mock, fired } = recordUpsertMock();

    // Ingredient id 999 has no entry in nutrition.ingredients (only id 1).
    const recipe = makeSpoonacularRecipe();
    recipe.extendedIngredients = [
      { ...recipe.extendedIngredients[0], id: 999 },
    ];

    const { result } = renderHookWithApollo(() => useRecipePreload(), {
      operationMocks: [mock],
    });

    await act(async () => {
      await result.current.preloadRecipe(recipe);
    });

    const sent = fired[0] as {
      input: {
        ingredients: Array<{
          externalSources: Array<{ spoonacular: { nutrition?: unknown } }>;
        }>;
      };
    };
    expect(
      sent.input.ingredients[0].externalSources[0].spoonacular.nutrition,
    ).toBeUndefined();
  });

  it('attaches estimatedCost from priceBreakdown when ingesting withCost', async () => {
    // Deliberate-save path: the recipe-scoped priceBreakdown (one call) is
    // fetched and its per-ingredient price (US cents) lands on the typed mirror.
    (
      spoonacularService.getRecipePriceBreakdown as jest.Mock
    ).mockResolvedValueOnce({
      ingredients: [
        {
          name: 'pasta',
          image: 'pasta.jpg',
          price: 187.5,
          amount: {
            metric: { value: 200, unit: 'g' },
            us: { value: 7, unit: 'oz' },
          },
        },
      ],
      totalCost: 187.5,
      totalCostPerServing: 46.875,
    });

    const { mock, fired } = recordUpsertMock();

    const { result } = renderHookWithApollo(() => useRecipePreload(), {
      operationMocks: [mock],
    });

    await act(async () => {
      await result.current.preloadRecipe(makeSpoonacularRecipe(), undefined, {
        withCost: true,
      });
    });

    expect(spoonacularService.getRecipePriceBreakdown).toHaveBeenCalledWith(
      123,
    );
    const sent = fired[0] as {
      input: {
        ingredients: Array<{
          externalSources: Array<{
            spoonacular: { estimatedCost?: { value: number; unit: string } };
          }>;
        }>;
      };
    };
    expect(
      sent.input.ingredients[0].externalSources[0].spoonacular.estimatedCost,
    ).toEqual({ value: 187.5, unit: 'US Cents' });
  });

  it('does not fetch priceBreakdown for a plain (view) preload', async () => {
    const { mock } = recordUpsertMock();

    const { result } = renderHookWithApollo(() => useRecipePreload(), {
      operationMocks: [mock],
    });

    await act(async () => {
      await result.current.preloadRecipe(makeSpoonacularRecipe());
    });

    expect(spoonacularService.getRecipePriceBreakdown).not.toHaveBeenCalled();
  });

  it('preloadRecipe returns cached result on second call', async () => {
    // Only one mock — if the second call hit the network MockedProvider would error
    const { result } = renderHookWithApollo(() => useRecipePreload(), {
      operationMocks: [
        buildUpsertMock(
          { id: 'backend-1', name: 'Test', imageUrl: null },
          false,
        ),
      ],
    });

    await act(async () => {
      await result.current.preloadRecipe(makeSpoonacularRecipe(99));
    });

    let secondResult!: PreloadedRecipe | null;
    await act(async () => {
      secondResult = await result.current.preloadRecipe(
        makeSpoonacularRecipe(99),
      );
    });

    expect(secondResult?.id).toBe('backend-1');
  });

  // `errorPolicy: 'all'` resolves a failed mutation with `error` set rather
  // than rejecting, so this drives the outcome the app actually gets.
  it('preloadRecipe returns null when the mutation fails', async () => {
    const { result } = renderHookWithApollo(() => useRecipePreload(), {
      operationMocks: [
        {
          request: {
            query: UpsertExternalRecipeDocument,
            variables: () => true,
          },
          error: new Error('network down'),
        },
      ],
    });

    let preloaded!: PreloadedRecipe | null;
    await act(async () => {
      preloaded = await result.current.preloadRecipe(
        makeSpoonacularRecipe(200),
      );
    });

    expect(preloaded).toBeNull();
  });

  it('clearCache resets all state', async () => {
    const { result } = renderHookWithApollo(() => useRecipePreload(), {
      operationMocks: [
        buildUpsertMock({ id: 'b1', name: 'R', imageUrl: null }, true),
      ],
    });

    await act(async () => {
      await result.current.preloadRecipe(makeSpoonacularRecipe(50));
    });

    expect(result.current.preloadedRecipe).not.toBeNull();

    act(() => {
      result.current.clearCache();
    });

    expect(result.current.preloadedRecipe).toBeNull();
    expect(result.current.preloadError).toBeNull();
  });
});

// =============================================================================
// Local-first favorite (client-minted SavedRecipe id)
// =============================================================================

// Reads just the optimistic-write signals: the SavedRecipe entity, the recipe's
// savedDetails pointer, and the MySavedRecipes edge.
const SAVED_DETAILS_FRAGMENT = gql`
  fragment _TestSavedDetails on Recipe {
    id
    savedDetails {
      id
    }
  }
`;
const SAVED_RECIPE_FRAGMENT = gql`
  fragment _TestSavedRecipe on SavedRecipe {
    id
    folder
    tags
    recipe {
      id
    }
  }
`;

/**
 * Build a cache pre-seeded with the backend Recipe (so the upsert's recipeId
 * resolves) and an empty MySavedRecipes connection (so updateQuery can prepend
 * the optimistic edge).
 */
function seedFavoriteCache(cache: InMemoryCache = makeCache()) {
  cache.writeQuery<MySavedRecipesQuery>({
    query: MySavedRecipesDocument,
    data: {
      __typename: 'Query',
      me: {
        __typename: 'User',
        id: 'u1',
        savedRecipesConnection: {
          __typename: 'SavedRecipeConnection',
          totalCount: 0,
          edges: [],
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    },
  });
  return cache;
}

// Resolve entity ids via cache.identify so the helpers work with both the bare
// InMemoryCache (`Recipe:backend-1`) and makeCache (`Recipe:{"id":"backend-1"}`)
// key formats.
const readSavedDetails = (cache: InMemoryCache) =>
  cache.readFragment<{ savedDetails: { id: string } | null }>({
    id: cache.identify({ __typename: 'Recipe', id: 'backend-1' }) ?? '',
    fragment: SAVED_DETAILS_FRAGMENT,
  })?.savedDetails;

const readSavedRecipe = (cache: InMemoryCache) =>
  cache.readFragment<{ id: string; recipe: { id: string } }>({
    id:
      cache.identify({ __typename: 'SavedRecipe', id: SAVED_RECIPE_ID }) ?? '',
    fragment: SAVED_RECIPE_FRAGMENT,
  });

const readSavedEdges = (cache: InMemoryCache) =>
  cache.readQuery<MySavedRecipesQuery>({ query: MySavedRecipesDocument })?.me
    ?.savedRecipesConnection;

/**
 * Mock AddRecipeToFavorites. `queued` resolves the field as null (offline / API
 * down — the optimistic write stands, no server overwrite), which is the
 * local-first case that proves the client-minted optimistic write survives.
 * `created` echoes the client-minted SavedRecipe id (the server persists it as
 * the PK) so the online `update` callback's dedup-by-id guard fires. `rejected`
 * resolves a refusal union member (revert path).
 */
const SERVER_SAVED_ID = 'server-saved-2';

const favoriteMock = (
  outcome:
    | { kind: 'queued' }
    | { kind: 'created' }
    | { kind: 'divergent' }
    | { kind: 'rejected'; __typename: 'ValidationError' },
): MockedResponse => ({
  request: {
    query: AddRecipeToFavoritesDocument,
    variables: () => true,
  },
  result: {
    data: {
      addRecipeToFavorites:
        outcome.kind === 'queued'
          ? null
          : outcome.kind === 'created' || outcome.kind === 'divergent'
          ? {
              __typename: 'AddRecipeToFavoritesPayload',
              savedRecipe: {
                __typename: 'SavedRecipe',
                id:
                  outcome.kind === 'divergent'
                    ? SERVER_SAVED_ID
                    : SAVED_RECIPE_ID,
                recipeId: 'backend-1',
                userId: 'u1',
                folder: null,
                tags: [],
                notes: null,
                personalRating: null,
                cookedCount: 0,
                lastCookedAt: null,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                recipe: { __typename: 'Recipe', id: 'backend-1' },
              },
            }
          : {
              __typename: 'ValidationError',
              code: ErrorCode.ValidationFailed,
              message: 'bad',
              field: 'recipeId',
            },
    },
  },
});

describe('useRecipePreload — local-first favorite', () => {
  it('writes the optimistic SavedRecipe (client id), savedDetails, and MySavedRecipes edge', async () => {
    const cache = seedFavoriteCache();
    const { result } = renderHookWithApollo(() => useRecipePreload(), {
      cache,
      operationMocks: [
        buildUpsertMock(
          { id: 'backend-1', name: 'Test Recipe', imageUrl: null },
          true,
        ),
        favoriteMock({ kind: 'queued' }),
      ],
    });

    let saveResult!: { success: boolean; recipeId?: string };
    await act(async () => {
      saveResult = await result.current.saveRecipeToFavorites(
        makeSpoonacularRecipe(),
        { folder: 'Dinner', tags: ['quick'] },
      );
    });

    expect(saveResult).toEqual({ success: true, recipeId: 'backend-1' });

    // (1) Optimistic SavedRecipe keyed by the CLIENT-MINTED id.
    const savedRecipe = readSavedRecipe(cache);
    expect(savedRecipe).toEqual(
      expect.objectContaining({
        id: SAVED_RECIPE_ID,
        folder: 'Dinner',
        tags: ['quick'],
        recipe: expect.objectContaining({ id: 'backend-1' }),
      }),
    );

    // (2) Recipe.savedDetails points at the optimistic SavedRecipe.
    expect(readSavedDetails(cache)).toEqual(
      expect.objectContaining({ id: SAVED_RECIPE_ID }),
    );

    // (3) MySavedRecipes edge added, keyed by the client id, totalCount bumped.
    const conn = readSavedEdges(cache);
    expect(conn?.totalCount).toBe(1);
    expect(conn?.edges.map(e => e.node.id)).toContain(SAVED_RECIPE_ID);
  });

  it('reverts all three cache writes when the server rejects', async () => {
    const cache = seedFavoriteCache();
    const { result } = renderHookWithApollo(() => useRecipePreload(), {
      cache,
      operationMocks: [
        buildUpsertMock(
          { id: 'backend-1', name: 'Test Recipe', imageUrl: null },
          true,
        ),
        favoriteMock({ kind: 'rejected', __typename: 'ValidationError' }),
      ],
    });

    let saveResult!: { success: boolean; recipeId?: string };
    await act(async () => {
      saveResult = await result.current.saveRecipeToFavorites(
        makeSpoonacularRecipe(),
      );
    });

    expect(saveResult).toEqual({ success: false });

    // All three optimistic writes are undone.
    expect(readSavedRecipe(cache)).toBeNull();
    expect(readSavedDetails(cache) ?? null).toBeNull();
    const conn = readSavedEdges(cache);
    expect(conn?.totalCount).toBe(0);
    expect(conn?.edges).toHaveLength(0);
  });

  it('does not duplicate the MySavedRecipes edge when the online response echoes the client id', async () => {
    // The server persists the client-minted id, so the online `update` callback
    // adds an edge with the SAME id the optimistic write already added — the
    // callback's exists-by-id guard must skip it (no duplicate / no double count).
    const cache = seedFavoriteCache();
    const { result } = renderHookWithApollo(() => useRecipePreload(), {
      cache,
      operationMocks: [
        buildUpsertMock(
          { id: 'backend-1', name: 'Test Recipe', imageUrl: null },
          true,
        ),
        favoriteMock({ kind: 'created' }),
      ],
    });

    await act(async () => {
      await result.current.saveRecipeToFavorites(makeSpoonacularRecipe());
    });

    const conn = readSavedEdges(cache);
    expect(conn?.edges.filter(e => e.node.id === SAVED_RECIPE_ID)).toHaveLength(
      1,
    );
    expect(conn?.totalCount).toBe(1);
  });

  it('reconciles a divergent server id (recipe already favorited elsewhere)', async () => {
    // The recipe was already favorited on another device, so the server resolves
    // to an EXISTING SavedRecipe whose id differs from the client-minted one.
    // The stale client-id entity must be evicted (its dangling edge drops) and
    // savedDetails re-pointed — leaving exactly one server-id edge, no phantom.
    // Uses the real cache policies so the self-healing connection read applies.
    const cache = seedFavoriteCache(makeCache());
    const { result } = renderHookWithApollo(() => useRecipePreload(), {
      cache,
      operationMocks: [
        buildUpsertMock(
          { id: 'backend-1', name: 'Test Recipe', imageUrl: null },
          true,
        ),
        favoriteMock({ kind: 'divergent' }),
      ],
    });

    await act(async () => {
      await result.current.saveRecipeToFavorites(makeSpoonacularRecipe());
    });

    // The optimistic client-id SavedRecipe is evicted.
    expect(readSavedRecipe(cache)).toBeNull();

    // savedDetails points at the server row, not the dangling client id.
    expect(readSavedDetails(cache)).toEqual(
      expect.objectContaining({ id: SERVER_SAVED_ID }),
    );

    // Exactly one edge remains — the server id — with no double count.
    const conn = readSavedEdges(cache);
    const ids = conn?.edges.map(e => e.node.id) ?? [];
    expect(ids).toEqual([SERVER_SAVED_ID]);
    expect(ids).not.toContain(SAVED_RECIPE_ID);
    expect(conn?.totalCount).toBe(1);
  });
});
