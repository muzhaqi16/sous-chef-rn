import { act } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { UpsertExternalRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { useRecipePreload } from '../useRecipePreload';

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
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
    nutrition: { nutrients: [{ name: 'Calories', amount: 350 }] },
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
  } as any);

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
          __typename: 'UpsertExternalRecipeResult',
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

    let preloaded: any;
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

    let secondResult: any;
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

    let preloaded: any;
    await act(async () => {
      preloaded = await result.current.preloadRecipe(
        makeSpoonacularRecipe(200),
      );
    });

    expect(preloaded).toBeNull();
  });

  it('isPreloaded returns false for unknown externalId', () => {
    const { result } = renderHookWithApollo(() => useRecipePreload());

    expect(result.current.isPreloaded('999')).toBe(false);
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
