import { waitFor } from '@testing-library/react-native';
import {
  Difficulty,
  RecipeCategory,
  RecipeStatus,
} from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { GetRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { useRecipeData } from '../useRecipeData';
import { spoonacularService } from '#/services/spoonacular/SpoonacularService';

jest.mock('#/services/spoonacular/SpoonacularService', () => ({
  spoonacularService: {
    getRecipeInformation: jest.fn(),
  },
}));

const noopPreload = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
});

function backendRecipeMock(
  recipe: {
    id: string;
    name: string;
    imageUrl?: string | null;
    servings?: number;
    totalTimeMinutes?: number | null;
    description?: string | null;
    source?: string | null;
    sourceUrl?: string | null;
    savedDetails?: Record<string, unknown> | null;
  } = { id: 'r1', name: 'Pasta', servings: 4 },
) {
  return recordMock(GetRecipeDocument, {
    data: {
      recipe: {
        __typename: 'Recipe',
        id: recipe.id,
        name: recipe.name,
        description: recipe.description ?? null,
        imageUrl: recipe.imageUrl ?? null,
        servings: recipe.servings ?? 4,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        totalTimeMinutes: recipe.totalTimeMinutes ?? null,
        difficulty: Difficulty.Easy,
        category: RecipeCategory.Dinner,
        cuisine: null,
        status: RecipeStatus.Published,
        caloriesPerServing: null,
        nutritionData: null,
        publishedAt: null,
        forkedFromId: null,
        forkedFrom: null,
        originalAuthor: null,
        tips: null,
        tags: [],
        savedDetails: recipe.savedDetails ?? null,
        instructions: [],
        notes: null,
        videoUrl: null,
        sourceUrl: recipe.sourceUrl ?? null,
        source: recipe.source ?? null,
        isPublished: true,
        averageRating: null,
        totalReviews: 0,
        rating1Count: 0,
        rating2Count: 0,
        rating3Count: 0,
        rating4Count: 0,
        rating5Count: 0,
        createdBy: null,
        ingredientsConnection: {
          __typename: 'RecipeIngredientConnection',
          edges: [],
        },
      },
    },
  });
}

describe('useRecipeData', () => {
  describe('with backend recipeId', () => {
    it('returns backend displayData mapped from GetRecipe', async () => {
      const m = backendRecipeMock({
        id: 'r1',
        name: 'Pasta Carbonara',
        servings: 2,
        totalTimeMinutes: 30,
        description: 'Classic Italian',
        imageUrl: 'http://example.com/pasta.jpg',
      });
      const { result } = renderHookWithApollo(
        () =>
          useRecipeData({
            recipeId: 'r1',
            externalSource: undefined,
            externalId: undefined,
            preloadRecipe: noopPreload,
          }),
        { operationMocks: [m.mock] },
      );

      await waitFor(() => expect(result.current.displayData).not.toBeNull());

      expect(result.current.isBackendRecipe).toBe(true);
      expect(result.current.displayData).toEqual(
        expect.objectContaining({
          title: 'Pasta Carbonara',
          servings: 2,
          readyInMinutes: 30,
          summary: 'Classic Italian',
          image: 'http://example.com/pasta.jpg',
        }),
      );
    });

    it('does not fire the Spoonacular fetch when recipeId is set', async () => {
      const m = backendRecipeMock();
      renderHookWithApollo(
        () =>
          useRecipeData({
            recipeId: 'r1',
            externalSource: undefined,
            externalId: undefined,
            preloadRecipe: noopPreload,
          }),
        { operationMocks: [m.mock] },
      );

      await new Promise(r => setTimeout(r, 50));
      expect(spoonacularService.getRecipeInformation).not.toHaveBeenCalled();
    });
  });

  describe('with external source/id only', () => {
    it('fetches via Spoonacular and maps to displayData', async () => {
      (
        spoonacularService.getRecipeInformation as jest.Mock
      ).mockResolvedValueOnce({
        title: 'External Pasta',
        servings: 6,
        readyInMinutes: 45,
        image: 'http://spoon.com/p.jpg',
        summary: 'Spoonacular pasta',
        extendedIngredients: [{ id: 1 }],
        analyzedInstructions: [],
        instructions: '<p>steps</p>',
        vegetarian: true,
        vegan: false,
        glutenFree: false,
        dairyFree: false,
        sourceName: 'Source',
        sourceUrl: 'http://source.com',
        healthScore: 75,
      });

      const { result } = renderHookWithApollo(() =>
        useRecipeData({
          recipeId: undefined,
          externalSource: 'SPOONACULAR',
          externalId: '12345',
          preloadRecipe: noopPreload,
        }),
      );

      await waitFor(() => expect(result.current.displayData).not.toBeNull());

      expect(result.current.isBackendRecipe).toBe(false);
      expect(result.current.displayData).toEqual(
        expect.objectContaining({
          title: 'External Pasta',
          servings: 6,
          readyInMinutes: 45,
          vegetarian: true,
          healthScore: 75,
          instructionsHtml: '<p>steps</p>',
        }),
      );
    });

    it('fires preloadRecipe for the loaded external recipe', async () => {
      const preload = jest.fn().mockResolvedValue(undefined);
      (
        spoonacularService.getRecipeInformation as jest.Mock
      ).mockResolvedValueOnce({
        title: 'X',
        servings: 1,
        extendedIngredients: [],
        analyzedInstructions: [],
      });

      renderHookWithApollo(() =>
        useRecipeData({
          recipeId: undefined,
          externalSource: 'SPOONACULAR',
          externalId: '99',
          preloadRecipe: preload,
        }),
      );

      await waitFor(() => expect(preload).toHaveBeenCalledTimes(1));
    });

    it('reports error when Spoonacular throws non-abort error', async () => {
      (
        spoonacularService.getRecipeInformation as jest.Mock
      ).mockRejectedValueOnce(new Error('500 Internal Server Error'));

      const { result } = renderHookWithApollo(() =>
        useRecipeData({
          recipeId: undefined,
          externalSource: 'SPOONACULAR',
          externalId: '12345',
          preloadRecipe: noopPreload,
        }),
      );

      await waitFor(() =>
        expect(result.current.error).toBe(
          'Failed to load recipe. Please try again.',
        ),
      );
      expect(result.current.displayData).toBeNull();
    });

    it('rejects unknown external sources', async () => {
      const { result } = renderHookWithApollo(() =>
        useRecipeData({
          recipeId: undefined,
          externalSource: 'UNKNOWN',
          externalId: '1',
          preloadRecipe: noopPreload,
        }),
      );

      await waitFor(() =>
        expect(result.current.error).toBe(
          'Failed to load recipe. Please try again.',
        ),
      );
    });
  });

  describe('with no recipeId and no external source', () => {
    it('reports "Recipe not available."', async () => {
      const { result } = renderHookWithApollo(() =>
        useRecipeData({
          recipeId: undefined,
          externalSource: undefined,
          externalId: undefined,
          preloadRecipe: noopPreload,
        }),
      );

      await waitFor(() =>
        expect(result.current.error).toBe('Recipe not available.'),
      );
      expect(result.current.displayData).toBeNull();
    });
  });

  describe('isBackendRecipe', () => {
    it('is false when recipeId is set but backend hasnt resolved', () => {
      const m = backendRecipeMock({ id: 'r1', name: 'X' });
      const { result } = renderHookWithApollo(
        () =>
          useRecipeData({
            recipeId: 'r1',
            externalSource: undefined,
            externalId: undefined,
            preloadRecipe: noopPreload,
          }),
        { operationMocks: [m.mock] },
      );
      expect(result.current.isBackendRecipe).toBe(false);
    });

    it('is true once backend recipe loads', async () => {
      const m = backendRecipeMock({ id: 'r1', name: 'X' });
      const { result } = renderHookWithApollo(
        () =>
          useRecipeData({
            recipeId: 'r1',
            externalSource: undefined,
            externalId: undefined,
            preloadRecipe: noopPreload,
          }),
        { operationMocks: [m.mock] },
      );
      await waitFor(() => expect(result.current.isBackendRecipe).toBe(true));
    });
  });

  describe('displayData precedence', () => {
    it('prefers backend recipe over external when both are present', async () => {
      const m = backendRecipeMock({ id: 'r1', name: 'Backend Title' });
      (
        spoonacularService.getRecipeInformation as jest.Mock
      ).mockResolvedValueOnce({
        title: 'External Title',
        extendedIngredients: [],
        analyzedInstructions: [],
      });

      const { result } = renderHookWithApollo(
        () =>
          useRecipeData({
            recipeId: 'r1',
            externalSource: 'SPOONACULAR',
            externalId: '1',
            preloadRecipe: noopPreload,
          }),
        { operationMocks: [m.mock] },
      );

      await waitFor(() => expect(result.current.displayData).not.toBeNull());
      expect(result.current.displayData?.title).toBe('Backend Title');
    });
  });
});
