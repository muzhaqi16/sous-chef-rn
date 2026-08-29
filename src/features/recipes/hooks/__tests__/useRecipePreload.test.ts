import { act } from '@testing-library/react-native';
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
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';

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

// Favoriting is ONLINE-ONLY: it no longer queues for replay, so the offline
// gate is part of the hook's contract rather than an incidental detail.
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: jest.fn(() => false),
}));
const mockIsApiUnavailable = useIsApiUnavailable as jest.MockedFunction<
  typeof useIsApiUnavailable
>;

// Deterministic client-minted SavedRecipe id (sent as `input.id`) so the
// cache assertions can target a known key.
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
            externalSource: 'SPOONACULAR',
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
          externalSource: 'SPOONACULAR',
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
  mockIsApiUnavailable.mockReturnValue(false);
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
    // The API stores names verbatim (it no longer strips prices), so the client
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
        source: 'SPOONACULAR',
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
// Favorite (online only, client-minted SavedRecipe id)
// =============================================================================

// Reads the three cache signals the server response drives: the SavedRecipe
// entity, the recipe's savedDetails pointer, and the MySavedRecipes edge.
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
function seedFavoriteCache(cache: InMemoryCache = new InMemoryCache()) {
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
 * Mock AddRecipeToFavorites. `created` echoes the client-minted SavedRecipe id
 * (the server persists it as the PK); `divergent` returns an EXISTING row under
 * a different id (already favorited elsewhere); `rejected` resolves a refusal
 * union member.
 */
const SERVER_SAVED_ID = 'server-saved-2';

const favoriteMock = (
  outcome:
    | { kind: 'created'; folder?: string | null; tags?: string[] }
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
        outcome.kind === 'created' || outcome.kind === 'divergent'
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
                folder:
                  outcome.kind === 'created' ? outcome.folder ?? null : null,
                tags: outcome.kind === 'created' ? outcome.tags ?? [] : [],
                notes: null,
                personalRating: null,
                cookedCount: 0,
                lastCookedAt: null,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                // The real response spreads BasicRecipeFragment here, which
                // covers every field the MySavedRecipes card node reads — the
                // server response is now the only writer of that edge, so the
                // mock has to carry them or the connection read goes incomplete.
                recipe: {
                  __typename: 'Recipe',
                  id: 'backend-1',
                  name: 'Test Recipe',
                  description: null,
                  imageUrl: null,
                  servings: 4,
                  prepTimeMinutes: 10,
                  cookTimeMinutes: 20,
                  totalTimeMinutes: 30,
                },
              },
            }
          : {
              __typename: 'ValidationError',
              code: 'VALIDATION',
              message: 'bad',
              field: 'recipeId',
            },
    },
  },
});

describe('useRecipePreload — favorite (online only)', () => {
  it('writes the server SavedRecipe, savedDetails, and MySavedRecipes edge', async () => {
    const cache = seedFavoriteCache();
    const { result } = renderHookWithApollo(() => useRecipePreload(), {
      cache,
      operationMocks: [
        buildUpsertMock(
          { id: 'backend-1', name: 'Test Recipe', imageUrl: null },
          true,
        ),
        favoriteMock({ kind: 'created', folder: 'Dinner', tags: ['quick'] }),
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

    // (1) SavedRecipe normalized from the response, keyed by the id the client
    //     minted and the server persisted.
    const savedRecipe = readSavedRecipe(cache);
    expect(savedRecipe).toEqual(
      expect.objectContaining({
        id: SAVED_RECIPE_ID,
        folder: 'Dinner',
        tags: ['quick'],
        recipe: expect.objectContaining({ id: 'backend-1' }),
      }),
    );

    // (2) Recipe.savedDetails points at the SavedRecipe (this is what fills the
    //     heart — the mutation response omits recipe.savedDetails).
    expect(readSavedDetails(cache)).toEqual(
      expect.objectContaining({ id: SAVED_RECIPE_ID }),
    );

    // (3) MySavedRecipes edge added, totalCount bumped.
    const conn = readSavedEdges(cache);
    expect(conn?.totalCount).toBe(1);
    expect(conn?.edges.map(e => e.node.id)).toContain(SAVED_RECIPE_ID);
  });

  it('toasts and fires nothing while the API is unreachable', async () => {
    mockIsApiUnavailable.mockReturnValue(true);
    const cache = seedFavoriteCache();
    const { mock: upsert, fired: upsertFired } = recordUpsertMock();
    const { result } = renderHookWithApollo(() => useRecipePreload(), {
      cache,
      operationMocks: [upsert, favoriteMock({ kind: 'created' })],
    });

    let saveResult!: { success: boolean; recipeId?: string };
    await act(async () => {
      saveResult = await result.current.saveRecipeToFavorites(
        makeSpoonacularRecipe(),
      );
    });

    expect(saveResult).toEqual({ success: false });
    expect(mockToastError).toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    // Neither the ingest nor the favorite left the device.
    expect(upsertFired).toHaveLength(0);
    expect(readSavedRecipe(cache)).toBeNull();
    expect(readSavedEdges(cache)?.totalCount).toBe(0);
    // The screen can gate the affordance up front.
    expect(result.current.isApiUnavailable).toBe(true);
  });

  it('leaves the cache untouched when the server rejects', async () => {
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

    // A refusal RESOLVES under errorPolicy:'all', so the guard against a refused
    // favorite sticking is the classifyCreateResult check, not a throw.
    expect(mockToastError).toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();

    // Nothing was written for the refused favorite.
    expect(readSavedRecipe(cache)).toBeNull();
    expect(readSavedDetails(cache) ?? null).toBeNull();
    const conn = readSavedEdges(cache);
    expect(conn?.totalCount).toBe(0);
    expect(conn?.edges).toHaveLength(0);
  });

  it('adds exactly one MySavedRecipes edge for a save', async () => {
    // The `update` callback's exists-by-id guard is what keeps a re-favorite of
    // an already-edged SavedRecipe from double-counting the connection.
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

  it('follows a divergent server id (recipe already favorited elsewhere)', async () => {
    // The recipe was already favorited on another device, so the server resolves
    // to an EXISTING SavedRecipe whose id differs from the client-minted one.
    // Everything must follow the response: savedDetails points at the server row
    // and the one edge carries the server id — nothing is written under the
    // client id. Uses the real cache policies so the connection read applies.
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

    // Nothing was written under the client-minted id.
    expect(readSavedRecipe(cache)).toBeNull();

    // savedDetails points at the server row.
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
