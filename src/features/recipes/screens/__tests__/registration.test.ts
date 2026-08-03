jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackScreen: <T>(config: T): T => config,
}));
jest.mock('../RecipeDetail', () => ({ RecipeDetail: () => null }));
jest.mock('../RecipeForm', () => ({ RecipeFormScreen: () => null }));
jest.mock('../SavedRecipes', () => ({ SavedRecipes: () => null }));
jest.mock('../MyRecipes', () => ({ MyRecipes: () => null }));

import { expectDeclaresLinkingIntent } from '#/test-utils/screenRegistration';
import { recipeDetailScreens } from '../registration';

describe('recipeDetailScreens', () => {
  it('registers every recipe detail screen', () => {
    expect(Object.keys(recipeDetailScreens).sort()).toEqual([
      'MyRecipes',
      'RecipeCreate',
      'RecipeDetail',
      'RecipeEdit',
      'SavedRecipes',
    ]);
  });

  // RecipeDetail is opened from Pantry, Recipe and MealPlan. One registration
  // serves all three, so its own fork/edit actions can't jump the user to a
  // different tab — see useAppNavigation's toRecipeDetail/toRecipeEdit.
  it('registers a single shared RecipeDetail', () => {
    expect(recipeDetailScreens.RecipeDetail).toBeDefined();
  });

  it('every screen declares an explicit linking intent', () => {
    expectDeclaresLinkingIntent(recipeDetailScreens);
  });
});
