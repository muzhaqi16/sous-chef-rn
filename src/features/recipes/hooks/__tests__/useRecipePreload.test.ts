import { act } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import {
  renderHookWithApollo,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import { UpsertExternalRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import type { RecipeInformation } from '#/services/recipeApi/types';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import { useRecipePreload, type PreloadedRecipe } from '../useRecipePreload';

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

jest.mock('#/utils/compilerSafeWrappers');

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
          result: {
            __typename: 'UpsertExternalRecipeData',
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
        result: {
          __typename: 'UpsertExternalRecipeData',
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

  it('preloadRecipe returns null when mutation fails', async () => {
    const { executeMutation } = require('#/utils/compilerSafeWrappers');
    executeMutation.mockResolvedValueOnce(false);

    const { result } = renderHookWithApollo(() => useRecipePreload());

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
