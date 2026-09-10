import { transformRecipeForDisplay } from '#domain/recipeTransform';
import type {
  RecipeSearchResult,
  SearchRecipesResult,
} from '#/services/spoonacular/types';

describe('transformRecipeForDisplay', () => {
  describe('ingredient-based search results', () => {
    const ingredientRecipe: RecipeSearchResult = {
      id: 42,
      title: 'Pasta Primavera',
      image: 'https://img.example.com/pasta.jpg',
      imageType: 'jpg',
      usedIngredientCount: 5,
      missedIngredientCount: 3,
      likes: 10,
      missedIngredients: [],
      usedIngredients: [],
      unusedIngredients: [],
    };

    it('returns the correct id format', () => {
      expect(transformRecipeForDisplay(ingredientRecipe).id).toBe(
        'spoonacular-42',
      );
    });

    it('preserves title', () => {
      expect(transformRecipeForDisplay(ingredientRecipe).title).toBe(
        'Pasta Primavera',
      );
    });

    it('shows ingredient count subtitle', () => {
      expect(transformRecipeForDisplay(ingredientRecipe).subtitle).toBe(
        '5/8 ingredients',
      );
    });

    it('includes likes badge when likes > 0', () => {
      const result = transformRecipeForDisplay(ingredientRecipe);
      expect(result.badge).toEqual({ text: '❤️ 10', variant: 'info' });
    });

    it('omits badge when likes is 0', () => {
      const result = transformRecipeForDisplay({
        ...ingredientRecipe,
        likes: 0,
      });
      expect(result.badge).toBeUndefined();
    });

    it('omits badge when likes is missing', () => {
      const { likes, ...noLikes } = ingredientRecipe;
      const result = transformRecipeForDisplay(noLikes);
      expect(result.badge).toBeUndefined();
    });

    it('preserves image url', () => {
      expect(transformRecipeForDisplay(ingredientRecipe).imageUrl).toBe(
        'https://img.example.com/pasta.jpg',
      );
    });

    it('preserves spoonacularId', () => {
      expect(transformRecipeForDisplay(ingredientRecipe).spoonacularId).toBe(
        42,
      );
    });
  });

  describe('text-based search results', () => {
    const textRecipe: SearchRecipesResult = {
      id: 99,
      title: 'Chicken Salad',
      image: 'https://img.example.com/salad.jpg',
      imageType: 'jpg',
      readyInMinutes: 30,
      servings: 4,
      aggregateLikes: 25,
    };

    it('shows time and servings subtitle', () => {
      expect(transformRecipeForDisplay(textRecipe).subtitle).toBe(
        '⏱ 30 min • 4 servings',
      );
    });

    it('shows only time when servings is missing', () => {
      const { servings, ...noServings } = textRecipe;
      expect(transformRecipeForDisplay(noServings).subtitle).toBe('⏱ 30 min');
    });

    it('shows only servings when time is missing', () => {
      const { readyInMinutes, ...noTime } = textRecipe;
      expect(transformRecipeForDisplay(noTime).subtitle).toBe('4 servings');
    });

    it('includes aggregateLikes badge', () => {
      const result = transformRecipeForDisplay(textRecipe);
      expect(result.badge).toEqual({ text: '❤️ 25', variant: 'info' });
    });

    it('omits badge when aggregateLikes is 0', () => {
      const result = transformRecipeForDisplay({
        ...textRecipe,
        aggregateLikes: 0,
      });
      expect(result.badge).toBeUndefined();
    });
  });
});
