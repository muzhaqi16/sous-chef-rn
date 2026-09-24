jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackScreen: <T>(config: T): T => config,
}));
jest.mock('../RecipeDetail', () => ({ RecipeDetail: () => null }));
jest.mock('../RecipeForm', () => ({ RecipeFormScreen: () => null }));
jest.mock('../SavedRecipes', () => ({ SavedRecipes: () => null }));
jest.mock('../MyRecipes', () => ({ MyRecipes: () => null }));
jest.mock('../RecipeLinkScreen', () => ({ RecipeLinkScreen: () => null }));

import { expectDeclaresLinkingIntent } from '#/test-utils/screenRegistration';
import { recipeDetailScreens } from '../registration';

describe('recipeDetailScreens', () => {
  it('registers every recipe detail screen', () => {
    expect(Object.keys(recipeDetailScreens).sort()).toEqual([
      'MyRecipes',
      'RecipeCreate',
      'RecipeDetail',
      'RecipeEdit',
      'RecipeLink',
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

  // RecipeDetail's params stay link-free: a path param would be required, and
  // an external recipe opens it with no id.
  it('links recipe emails through RecipeLink, not RecipeDetail', () => {
    expect(recipeDetailScreens.RecipeLink.linking).toBe('recipes/:recipeId');
    expect(recipeDetailScreens.RecipeDetail.linking).toBeNull();
  });
});
