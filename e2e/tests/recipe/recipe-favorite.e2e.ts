/**
 * Recipe Favorite E2E Tests
 *
 * Tests for recipe favoriting functionality including:
 * - Save/unsave recipes
 * - Organize into folders
 * - Add tags
 */

import { element, by, waitFor, expect } from 'detox';
import { RecipesScreen, RecipeDetailScreen } from '../../screens';
import { bootstrapAuthenticatedSession, relaunchToHomeTab } from '../../helpers';
import { TIMEOUTS } from '../../helpers/waitFor';
import { tapByID } from '../../helpers/actions';

describe('Recipe Favorite', () => {
  const recipesScreen = new RecipesScreen();
  const recipeDetailScreen = new RecipeDetailScreen();

  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
  });

  beforeEach(async () => {
    await relaunchToHomeTab();
    await recipesScreen.navigateToTab();
    await recipesScreen.waitForScreen();
  });

  describe('Save Recipe', () => {
    it('should save a recipe from suggestions', async () => {
      // Find a suggested recipe and open it
      const suggestion = element(by.id('suggested-recipe-0'));
      await waitFor(suggestion).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await suggestion.tap();

      await recipeDetailScreen.waitForScreen(TIMEOUTS.DEFAULT);

      // Tap favorite button
      await recipeDetailScreen.toggleFavorite();

      // Verify the favorite state changed
      await recipeDetailScreen.expectFavorited();

      await recipeDetailScreen.goBack();
      await recipesScreen.waitForScreen();
    });

    it('should unsave a recipe', async () => {
      // Open a saved recipe
      const savedRecipe = element(by.id('recipe-card-0'));
      await waitFor(savedRecipe).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await savedRecipe.tap();

      await recipeDetailScreen.waitForScreen(TIMEOUTS.DEFAULT);

      // Toggle favorite (unsave)
      await recipeDetailScreen.toggleFavorite();

      // Confirm if needed
      try {
        await waitFor(element(by.id('confirm-unsave-button')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.QUICK);
        await tapByID('confirm-unsave-button');
      } catch {
        // No confirmation needed
      }

      // Verify the unfavorited state
      await recipeDetailScreen.expectNotFavorited();

      await recipeDetailScreen.goBack();
      await recipesScreen.waitForScreen();
    });
  });

  describe('Organize Recipes', () => {
    it('should add recipe to folder', async () => {
      const recipe = element(by.id('recipe-card-0'));
      await waitFor(recipe).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await recipe.tap();

      await recipeDetailScreen.waitForScreen(TIMEOUTS.DEFAULT);

      // Find folder/organize button
      const organizeButton = element(by.id('recipe-organize-button'));
      await waitFor(organizeButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await organizeButton.tap();

      // Select a folder or create a new one
      try {
        const folderOption = element(by.id('folder-option-0'));
        await waitFor(folderOption).toBeVisible().withTimeout(TIMEOUTS.QUICK);
        await folderOption.tap();
      } catch {
        // Create new folder
        const createFolder = element(by.id('create-folder-button'));
        await waitFor(createFolder).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
        await createFolder.tap();

        const folderNameInput = element(by.id('folder-name-input'));
        await waitFor(folderNameInput).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
        await folderNameInput.typeText('E2E Test Folder');

        const saveFolder = element(by.id('save-folder-button'));
        await saveFolder.tap();
      }

      await recipeDetailScreen.goBack();
      await recipesScreen.waitForScreen();
    });

    it('should add tags to recipe', async () => {
      const recipe = element(by.id('recipe-card-0'));
      await waitFor(recipe).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await recipe.tap();

      await recipeDetailScreen.waitForScreen(TIMEOUTS.DEFAULT);

      // Find tags button
      const tagsButton = element(by.id('recipe-tags-button'));
      await waitFor(tagsButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await tagsButton.tap();

      // Add a tag
      try {
        const tagInput = element(by.id('tag-input'));
        await waitFor(tagInput).toBeVisible().withTimeout(TIMEOUTS.QUICK);
        await tagInput.typeText('dinner');

        const addTagButton = element(by.id('add-tag-button'));
        await addTagButton.tap();
      } catch {
        // Select existing tag
        const tagOption = element(by.id('tag-option-0'));
        await waitFor(tagOption).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
        await tagOption.tap();
      }

      await recipeDetailScreen.goBack();
      await recipesScreen.waitForScreen();
    });
  });

  describe('Recipe Detail Interactions', () => {
    it('should show recipe ingredients', async () => {
      const recipe = element(by.id('recipe-card-0'));
      await waitFor(recipe).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await recipe.tap();

      await recipeDetailScreen.waitForScreen(TIMEOUTS.DEFAULT);

      // Look for ingredients section (may need to scroll)
      try {
        await recipeDetailScreen.expectIngredientsVisible();
      } catch {
        await recipeDetailScreen.scrollToBottom();
        await recipeDetailScreen.expectIngredientsVisible();
      }

      await recipeDetailScreen.goBack();
      await recipesScreen.waitForScreen();
    });

    it('should add ingredients to shopping list', async () => {
      const recipe = element(by.id('recipe-card-0'));
      await waitFor(recipe).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await recipe.tap();

      await recipeDetailScreen.waitForScreen(TIMEOUTS.DEFAULT);

      // Add to shopping list
      await recipeDetailScreen.addToShoppingList();

      await recipeDetailScreen.goBack();
      await recipesScreen.waitForScreen();
    });

    it('should adjust servings', async () => {
      const recipe = element(by.id('recipe-card-0'));
      await waitFor(recipe).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await recipe.tap();

      await recipeDetailScreen.waitForScreen(TIMEOUTS.DEFAULT);

      // Adjust servings
      await recipeDetailScreen.adjustServings(true); // increase
      await recipeDetailScreen.adjustServings(true); // increase again
      await recipeDetailScreen.adjustServings(false); // decrease

      await recipeDetailScreen.goBack();
      await recipesScreen.waitForScreen();
    });
  });
});
