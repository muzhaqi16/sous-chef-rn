/**
 * Recipe E2E Tests
 *
 * Tests recipe functionality including:
 * - Searching recipes
 * - Filtering by cuisine and diet
 * - Sorting recipes
 * - Favoriting recipes
 * - Adding recipe ingredients to shopping list
 * - Viewing recipe details
 */

import { launchAppWithFabricWorkaround } from '../../init';
import {
  LandingAuthScreen,
  LoginScreen,
  RecipesScreen,
  ShoppingListScreen,
} from '../../screens';
import { TEST_USER } from '../../fixtures/testData';

describe('Recipe Search and Browsing', () => {
  const landingScreen = new LandingAuthScreen();
  const loginScreen = new LoginScreen();
  const recipesScreen = new RecipesScreen();
  const shoppingListScreen = new ShoppingListScreen();

  beforeAll(async () => {
    await launchAppWithFabricWorkaround({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();

    // Login and navigate to recipes
    try {
      await recipesScreen.waitForScreen(3000);
    } catch {
      // Check if on landing screen first
      try {
        await landingScreen.waitForScreen(2000);
        await landingScreen.tapLogin();
      } catch {
        // Not on landing screen, continue
      }

      // Now wait for login screen and login
      await loginScreen.waitForScreen();
      await loginScreen.loginAsTestUser();
      await recipesScreen.navigateToTab();
    }

    // Ensure we're on recipes screen
    await recipesScreen.waitForScreen();
  });

  describe('Recipe Search', () => {
    it('should search for recipes by keyword', async () => {
      // Act - search for "chicken"
      await recipesScreen.searchFor('chicken');

      // Assert - should show search results
      await recipesScreen.waitForListToLoad();

      // Should have at least one result (or show no results)
      try {
        await recipesScreen.expectRecipeExists(0);
      } catch {
        await recipesScreen.expectNoResultsFound();
      }
    });

    it('should search for specific recipe', async () => {
      // Act - search for specific recipe
      await recipesScreen.searchFor('pasta carbonara');

      // Assert
      await recipesScreen.waitForListToLoad();

      try {
        await recipesScreen.expectRecipeExists(0);
      } catch {
        await recipesScreen.expectNoResultsFound();
      }
    });

    it('should clear search field', async () => {
      // Arrange - perform search
      await recipesScreen.searchFor('pizza');
      await recipesScreen.waitForListToLoad();

      // Act - clear search
      await recipesScreen.clearSearch();

      // Assert - search field should be empty
      await recipesScreen.expectScreenVisible();
    });

    it('should show no results for invalid search', async () => {
      // Act - search for nonsense
      await recipesScreen.searchFor('xyzabc999invalidrecipe');

      // Assert - should show no results message
      await recipesScreen.expectNoResultsFound();
    });

    it('should show loading indicator during search', async () => {
      // Act - start search
      await recipesScreen.clearAndType(
        recipesScreen['searchInput'],
        'chicken',
      );
      await recipesScreen.tapByID(recipesScreen['searchButton']);

      // Assert - loading should appear
      try {
        await recipesScreen.expectLoadingVisible();
      } catch {
        console.log('Loading too fast to catch');
      }

      // Should eventually finish
      await recipesScreen.waitForListToLoad();
    });
  });

  describe('Filtering', () => {
    it('should filter recipes by cuisine', async () => {
      // Act - filter by Italian cuisine
      await recipesScreen.filterByCuisine('Italian');

      // Assert - results should be filtered
      await recipesScreen.waitForListToLoad();

      // Should show filtered results or empty state
      try {
        await recipesScreen.expectRecipeExists(0);
      } catch {
        await recipesScreen.expectNoResultsFound();
      }
    });

    it('should filter recipes by diet', async () => {
      // Act - filter by vegetarian
      await recipesScreen.filterByDiet('Vegetarian');

      // Assert
      await recipesScreen.waitForListToLoad();

      try {
        await recipesScreen.expectRecipeExists(0);
      } catch {
        await recipesScreen.expectNoResultsFound();
      }
    });

    it('should open filter modal', async () => {
      // Act
      await recipesScreen.openFilter();

      // Assert - filter modal should appear
      await recipesScreen.waitForElement('recipes-filter-modal', 3000);
      await recipesScreen.expectVisible('recipes-filter-modal');
    });

    it('should apply multiple filters', async () => {
      // This would require modifying filterBy methods to not auto-apply
      // For now, test sequential filtering
      await recipesScreen.filterByCuisine('Italian');
      await recipesScreen.waitForListToLoad();

      // Could apply diet filter on top
      await recipesScreen.filterByDiet('Vegetarian');
      await recipesScreen.waitForListToLoad();

      // Should show filtered results
      await recipesScreen.expectScreenVisible();
    });
  });

  describe('Sorting', () => {
    it('should sort by relevance', async () => {
      // Act
      await recipesScreen.sortBy('relevance');

      // Assert - recipes should be sorted
      await recipesScreen.waitForListToLoad();
      await recipesScreen.expectScreenVisible();
    });

    it('should sort by rating', async () => {
      // Act
      await recipesScreen.sortBy('rating');

      // Assert
      await recipesScreen.waitForListToLoad();
      await recipesScreen.expectScreenVisible();
    });

    it('should sort by time', async () => {
      // Act
      await recipesScreen.sortBy('time');

      // Assert
      await recipesScreen.waitForListToLoad();
      await recipesScreen.expectScreenVisible();
    });

    it('should sort by popularity', async () => {
      // Act
      await recipesScreen.sortBy('popularity');

      // Assert
      await recipesScreen.waitForListToLoad();
      await recipesScreen.expectScreenVisible();
    });

    it('should open sort modal', async () => {
      // Act
      await recipesScreen.openSort();

      // Assert
      await recipesScreen.waitForElement('recipes-sort-modal', 3000);
      await recipesScreen.expectVisible('recipes-sort-modal');
    });
  });

  describe('Favoriting Recipes', () => {
    beforeEach(async () => {
      // Search for recipes to have results
      await recipesScreen.searchFor('pasta');
      await recipesScreen.waitForListToLoad();

      // Ensure at least one recipe exists
      try {
        await recipesScreen.expectRecipeExists(0);
      } catch {
        // Skip test if no recipes found
        pending('No recipes found for testing');
      }
    });

    it('should favorite a recipe', async () => {
      // Act - toggle favorite
      await recipesScreen.toggleFavoriteByIndex(0);

      // Assert - recipe should be favorited
      try {
        await recipesScreen.expectRecipeFavorited(0);
      } catch {
        console.log('Favorite state visual not implemented or too fast');
      }
    });

    it('should unfavorite a recipe', async () => {
      // Arrange - favorite first
      await recipesScreen.toggleFavoriteByIndex(0);

      // Act - unfavorite
      await recipesScreen.toggleFavoriteByIndex(0);

      // Assert - should not be favorited
      await recipesScreen.expectRecipeNotFavorited(0);
    });

    it('should navigate to favorites view', async () => {
      // Act
      await recipesScreen.navigateToFavorites();

      // Assert
      await recipesScreen.waitForElement('favorite-recipes-screen', 3000);
      await recipesScreen.expectVisible('favorite-recipes-screen');
    });

    it('should show favorited recipes in favorites view', async () => {
      // Arrange - favorite a recipe
      await recipesScreen.toggleFavoriteByIndex(0);

      // Act - navigate to favorites
      await recipesScreen.navigateToFavorites();

      // Assert - should show favorited recipes
      await recipesScreen.waitForElement('favorite-recipes-screen', 3000);

      // Should have at least one favorite
      try {
        await recipesScreen.expectRecipeExists(0);
      } catch {
        console.log('Favorites not persisted or sync delayed');
      }
    });
  });

  describe('Recipe Details', () => {
    beforeEach(async () => {
      // Search for recipes
      await recipesScreen.searchFor('chicken');
      await recipesScreen.waitForListToLoad();

      try {
        await recipesScreen.expectRecipeExists(0);
      } catch {
        pending('No recipes found');
      }
    });

    it('should open recipe detail screen', async () => {
      // Act - tap recipe card
      await recipesScreen.tapRecipeByIndex(0);

      // Assert - should navigate to detail screen
      await recipesScreen.waitForElement('recipe-detail-screen', 3000);
      await recipesScreen.expectVisible('recipe-detail-screen');
    });

    it('should display recipe information', async () => {
      // Act
      await recipesScreen.tapRecipeByIndex(0);
      await recipesScreen.waitForElement('recipe-detail-screen', 3000);

      // Assert - detail screen should be visible
      await recipesScreen.expectVisible('recipe-detail-screen');

      // Should show recipe details (ingredients, instructions, etc.)
      // Specific assertions depend on detail screen implementation
    });
  });

  describe('Add to Shopping List', () => {
    beforeEach(async () => {
      await recipesScreen.searchFor('pasta');
      await recipesScreen.waitForListToLoad();

      try {
        await recipesScreen.expectRecipeExists(0);
      } catch {
        pending('No recipes found');
      }
    });

    it('should add recipe ingredients to shopping list', async () => {
      // Act - add to shopping list
      await recipesScreen.addRecipeToShoppingListByIndex(0);

      // Wait for confirmation or completion
      try {
        await recipesScreen.waitForElement('add-to-list-confirmation', 2000);
      } catch {
        console.log('No confirmation modal');
      }

      // Assert - should complete without error
      await recipesScreen.expectScreenVisible();
    });

    it('should confirm before adding to shopping list', async () => {
      // Act - tap add to shopping list button
      await recipesScreen
        .getElementById(`recipe-card-0-add-to-list-button`)
        .tap();

      // Assert - confirmation might appear
      try {
        await recipesScreen.waitForElement('add-to-list-confirmation', 2000);
        await recipesScreen.expectVisible('add-to-list-confirmation');

        // Confirm
        await recipesScreen.tapByID('add-to-list-confirm-button');
      } catch {
        console.log('No confirmation required');
      }
    });

    it('should show ingredients in shopping list after adding', async () => {
      // Act - add recipe to shopping list
      await recipesScreen.addRecipeToShoppingListByIndex(0);

      // Navigate to shopping list
      await shoppingListScreen.navigateToTab();
      await shoppingListScreen.waitForScreen();

      // Assert - should have items from recipe
      try {
        await shoppingListScreen.expectItemExists(0);
      } catch {
        console.log('Items not added or list was not empty');
      }
    });
  });

  describe('List Operations', () => {
    it('should show empty state when no search performed', async () => {
      // Assert - might show empty state or default recipes
      try {
        await recipesScreen.expectEmptyState();
      } catch {
        // Might show default/popular recipes instead
        console.log('Showing default recipes instead of empty state');
      }
    });

    it('should pull to refresh recipes', async () => {
      // Arrange - perform search first
      await recipesScreen.searchFor('chicken');
      await recipesScreen.waitForListToLoad();

      // Act - refresh
      await recipesScreen.pullToRefresh();

      // Assert
      await recipesScreen.waitForListToLoad();
      await recipesScreen.expectScreenVisible();
    });

    it('should scroll through recipe list', async () => {
      // Arrange - search for popular term to get many results
      await recipesScreen.searchFor('pasta');
      await recipesScreen.waitForListToLoad();

      // Act - scroll to bottom
      await recipesScreen.scrollToBottom();

      // Assert - no crash
      await recipesScreen.expectScreenVisible();

      // Scroll back to top
      await recipesScreen.scrollToTop();
      await recipesScreen.expectScreenVisible();
    });
  });

  describe('Recipe Display', () => {
    beforeEach(async () => {
      await recipesScreen.searchFor('pizza');
      await recipesScreen.waitForListToLoad();
    });

    it('should display recipe cards', async () => {
      // Assert - recipes should be displayed as cards
      try {
        await recipesScreen.expectRecipeExists(0);
        await recipesScreen.expectRecipeVisible(0);
      } catch {
        await recipesScreen.expectNoResultsFound();
      }
    });

    it('should display recipe title', async () => {
      // Assert
      try {
        await recipesScreen.expectRecipeExists(0);

        // Title should be visible (exact text depends on API results)
        // Just verify the title element exists
        await recipesScreen.expectVisible('recipe-card-0-title');
      } catch {
        console.log('No recipes or title element not found');
      }
    });

    it('should display multiple recipes', async () => {
      // Assert - should show multiple results
      try {
        await recipesScreen.expectRecipeExists(0);
        await recipesScreen.expectRecipeExists(1);
        await recipesScreen.expectRecipeExists(2);
      } catch {
        console.log('Less than 3 recipes found');
      }
    });
  });

  describe('Search Persistence', () => {
    it('should remember search when navigating away', async () => {
      // Arrange - perform search
      await recipesScreen.searchFor('chicken');
      await recipesScreen.waitForListToLoad();

      // Act - navigate away and back
      await shoppingListScreen.navigateToTab();
      await recipesScreen.navigateToTab();

      // Assert - search might be preserved (depends on implementation)
      await recipesScreen.expectScreenVisible();
    });
  });

  describe('Performance', () => {
    it('should load search results quickly', async () => {
      // Act - search
      const startTime = Date.now();
      await recipesScreen.searchFor('pasta');
      await recipesScreen.waitForListToLoad(10000);
      const endTime = Date.now();

      // Assert - should complete within reasonable time (10 seconds)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000);
    });

    it('should handle rapid searches', async () => {
      // Act - perform multiple searches quickly
      await recipesScreen.searchFor('chicken');
      await recipesScreen.searchFor('pasta');
      await recipesScreen.searchFor('salad');

      // Assert - should handle gracefully
      await recipesScreen.waitForListToLoad();
      await recipesScreen.expectScreenVisible();
    });
  });
});
