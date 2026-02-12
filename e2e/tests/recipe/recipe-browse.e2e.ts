/**
 * Recipe Browse E2E Tests
 *
 * Tests for recipe browsing functionality including:
 * - Display saved recipes
 * - Navigate to recipe detail
 * - Filter by folder/tags
 */

import { element, by, waitFor, expect } from 'detox';
import { RecipesScreen, RecipeDetailScreen } from '../../screens';
import { bootstrapAuthenticatedSession, relaunchToHomeTab } from '../../helpers';
import { TIMEOUTS } from '../../helpers/waitFor';
import { tapByID } from '../../helpers/actions';

describe('Recipe Browse', () => {
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

  describe('Display Recipes', () => {
    it('should display recipes screen', async () => {
      await recipesScreen.expectScreenVisible();
    });

    it('should show saved recipes or suggestions', async () => {
      // Screen should show either saved recipes, suggestions, or empty state
      // Use waitForAnyElement pattern: check for the first visible element
      let foundContent = false;

      try {
        await waitFor(element(by.id('recipe-list')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);
        foundContent = true;
      } catch {
        // Not a recipe list
      }

      if (!foundContent) {
        try {
          await waitFor(element(by.text('Need inspiration?')))
            .toBeVisible()
            .withTimeout(TIMEOUTS.QUICK);
          foundContent = true;
        } catch {
          // Not suggestions
        }
      }

      if (!foundContent) {
        await waitFor(element(by.id('recipe-empty-state')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);
        foundContent = true;
      }

      if (!foundContent) {
        throw new Error('No content found - expected recipe list, suggestions, or empty state');
      }
    });

    it('should show search functionality', async () => {
      // Check for search button or search input
      let foundSearch = false;

      try {
        await waitFor(element(by.id('recipe-search-button')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.QUICK);
        foundSearch = true;
      } catch {
        // No search button
      }

      if (!foundSearch) {
        await waitFor(element(by.id('recipe-search-input')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);
        foundSearch = true;
      }

      if (!foundSearch) {
        throw new Error('No search UI found - expected search button or search input');
      }
    });
  });

  describe('Recipe Navigation', () => {
    it('should navigate to recipe detail', async () => {
      // Find first recipe item by card testID pattern
      const firstRecipe = element(by.id('recipe-card-0'));
      await waitFor(firstRecipe).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await firstRecipe.tap();

      // Should navigate to detail screen
      await recipeDetailScreen.waitForScreen(TIMEOUTS.DEFAULT);

      // Go back
      await recipeDetailScreen.goBack();
      await recipesScreen.waitForScreen();
    });

    it('should navigate to recipe search', async () => {
      await tapByID('recipe-search-button');
      await waitFor(element(by.id('recipe-search-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await recipesScreen.goBack();
      await recipesScreen.waitForScreen();
    });
  });

  describe('Filter Recipes', () => {
    it('should filter by folder', async () => {
      const folderFilter = element(by.id('folder-filter-button'));
      await waitFor(folderFilter).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await folderFilter.tap();

      // Select a folder
      const folderOption = element(by.id('folder-option-0'));
      await waitFor(folderOption).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await folderOption.tap();

      await recipesScreen.waitForListToLoad();
    });

    it('should filter by tags', async () => {
      const tagFilter = element(by.id('tag-filter-button'));
      await waitFor(tagFilter).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await tagFilter.tap();

      // Select a tag
      const tagOption = element(by.id('tag-option-0'));
      await waitFor(tagOption).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await tagOption.tap();

      await recipesScreen.waitForListToLoad();
    });

    it('should clear filters', async () => {
      const clearButton = element(by.text('Clear'));
      await waitFor(clearButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await clearButton.tap();

      await recipesScreen.waitForListToLoad();
    });
  });

  describe('Suggested Recipes', () => {
    it('should show suggested recipes for new users', async () => {
      await waitFor(element(by.text('Need inspiration?')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Try refreshing suggestions
      const refreshButton = element(by.id('refresh-suggestions-button'));
      await waitFor(refreshButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await refreshButton.tap();

      // Wait for suggestions to reload
      await recipesScreen.waitForListToLoad();
    });

    it('should navigate to suggested recipe detail', async () => {
      const suggestion = element(by.id('suggested-recipe-0'));
      await waitFor(suggestion).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await suggestion.tap();

      await recipeDetailScreen.waitForScreen(TIMEOUTS.DEFAULT);

      await recipeDetailScreen.goBack();
      await recipesScreen.waitForScreen();
    });
  });

  describe('Pull to Refresh', () => {
    it('should refresh recipes on pull down', async () => {
      const recipeList = element(by.id('recipe-list'));
      await waitFor(recipeList).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await recipeList.swipe('down', 'fast', 0.5);

      // Recipes should reload
      await recipesScreen.waitForScreen();
    });
  });
});
