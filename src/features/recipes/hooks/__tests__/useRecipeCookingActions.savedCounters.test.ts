import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { MarkRecipeAsCookedDocument } from '#features/recipes/graphql/recipe.generated';
import { UseRecipeData_RecipeFragmentDoc } from '#features/recipes/hooks/useRecipeData.generated';
import type { RootState } from '#store';
import { useRecipeCookingActions } from '../useRecipeCookingActions';

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (s: RootState) => unknown) =>
    selector({ selectedPantryId: 'pantry-1' } as RootState),
  useSelectedPantryId: jest.fn(() => 'pantry-1'),
}));

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('#/utils/finallyHelpers');
jest.mock('#/apollo/links/tokenScheduler');

const COOKED_AT = '2026-10-13T18:30:00.000Z';

/** What the detail screen reads of the saved recipe, as the cache holds it. */
const readSavedDetails = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment({
    id: cache.identify({ __typename: 'Recipe', id: 'recipe-1' }),
    fragment: UseRecipeData_RecipeFragmentDoc,
    fragmentName: 'useRecipeData_recipe',
    returnPartialData: true,
  })?.savedDetails;

describe('useRecipeCookingActions — the saved recipe after a cook', () => {
  it('shows the cooked count and the last-cooked date the cook returns', async () => {
    const cache = seedCache([
      {
        __typename: 'Recipe',
        id: 'recipe-1',
        savedDetails: {
          __typename: 'SavedRecipe',
          id: 'saved-1',
          cookedCount: 2,
          lastCookedAt: null,
        },
      },
    ]);
    expect(readSavedDetails(cache)).toMatchObject({
      cookedCount: 2,
      lastCookedAt: null,
    });

    const cooked = recordMock(MarkRecipeAsCookedDocument, {
      data: {
        markRecipeAsCooked: {
          __typename: 'MarkRecipeAsCookedPayload',
          skippedIngredients: [],
          recipe: {
            __typename: 'Recipe',
            id: 'recipe-1',
            savedDetails: {
              __typename: 'SavedRecipe',
              id: 'saved-1',
              cookedCount: 3,
              lastCookedAt: COOKED_AT,
            },
          },
        },
      },
    });
    const { result } = renderHookWithApollo(
      () => useRecipeCookingActions({ recipeId: 'recipe-1' }),
      { cache, operationMocks: [cooked.mock] },
    );

    await act(async () => {
      result.current.handleMarkAsCooked({
        servings: 4,
        deductFromPantry: false,
        useGranularDeduction: false,
      });
    });

    await waitFor(() =>
      expect(readSavedDetails(cache)).toMatchObject({
        cookedCount: 3,
        lastCookedAt: COOKED_AT,
      }),
    );
  });
});
