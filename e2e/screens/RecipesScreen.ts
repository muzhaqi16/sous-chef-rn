/**
 * RecipesScreen
 *
 * Screen object model for the Recipes screen.
 * Provides methods for interacting with recipe search and browsing functionality.
 */

import { BaseScreen } from './BaseScreen';
import { element, by, waitFor } from 'detox';

export class RecipesScreen extends BaseScreen {
  protected screenID = 'recipes-screen';

  // Element IDs
  private readonly searchInput = 'recipes-search-input';
  private readonly searchButton = 'recipes-search-button';
  private readonly filterButton = 'recipes-filter-button';
  private readonly sortButton = 'recipes-sort-button';
  private readonly listContainer = 'recipes-list';
  private readonly emptyState = 'recipes-empty-state';
  private readonly loadingIndicator = 'recipes-loading';
  private readonly refreshControl = 'recipes-refresh-control';
  private readonly favoritesButton = 'recipes-favorites-button';

  /**
   * Get recipe card by index
   */
  private getRecipeByIndex(index: number) {
    return element(by.id(`recipe-card-${index}`));
  }

  /**
   * Get recipe title by index
   */
  private getRecipeTitleByIndex(index: number) {
    return element(by.id(`recipe-card-${index}-title`));
  }

  /**
   * Get recipe favorite button by index
   */
  private getRecipeFavoriteButtonByIndex(index: number) {
    return element(by.id(`recipe-card-${index}-favorite-button`));
  }

  /**
   * Get recipe add to list button by index
   */
  private getRecipeAddToListButtonByIndex(index: number) {
    return element(by.id(`recipe-card-${index}-add-to-list-button`));
  }

  /**
   * Navigate to recipes tab
   * Note: Tab testID is 'tab-recipe' (singular) based on route name 'Recipe'
   */
  async navigateToTab() {
    await this.tapByID('tab-recipe');
    await this.waitForScreen();
  }

  /**
   * Search for recipes
   */
  async searchFor(query: string) {
    await this.clearAndType(this.searchInput, query);
    await this.dismissKeyboard();
    await this.tapByID(this.searchButton);
    await this.waitForListToLoad();
  }

  /**
   * Clear search
   */
  async clearSearch() {
    await this.getElementById(this.searchInput).clearText();
  }

  /**
   * Open filter menu
   */
  async openFilter() {
    await this.tapByID(this.filterButton);
    await waitFor(element(by.id('recipes-filter-modal')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Apply filter by cuisine
   */
  async filterByCuisine(cuisine: string) {
    await this.openFilter();
    await this.tapByID(`filter-cuisine-${cuisine.toLowerCase()}`);
    await this.tapByID('filter-apply-button');
    await waitFor(element(by.id('recipes-filter-modal')))
      .not.toBeVisible()
      .withTimeout(3000);
    await this.waitForListToLoad();
  }

  /**
   * Apply filter by dietary restriction
   */
  async filterByDiet(diet: string) {
    await this.openFilter();
    await this.tapByID(`filter-diet-${diet.toLowerCase()}`);
    await this.tapByID('filter-apply-button');
    await waitFor(element(by.id('recipes-filter-modal')))
      .not.toBeVisible()
      .withTimeout(3000);
    await this.waitForListToLoad();
  }

  /**
   * Open sort menu
   */
  async openSort() {
    await this.tapByID(this.sortButton);
    await waitFor(element(by.id('recipes-sort-modal')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Sort recipes
   */
  async sortBy(sortOption: 'relevance' | 'rating' | 'time' | 'popularity') {
    await this.openSort();
    await this.tapByID(`sort-option-${sortOption}`);
    await waitFor(element(by.id('recipes-sort-modal')))
      .not.toBeVisible()
      .withTimeout(3000);
    await this.waitForListToLoad();
  }

  /**
   * Navigate to favorites
   */
  async navigateToFavorites() {
    await this.tapByID(this.favoritesButton);
    await waitFor(element(by.id('favorite-recipes-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Tap recipe card to view details
   */
  async tapRecipeByIndex(index: number) {
    await this.getRecipeByIndex(index).tap();
    await waitFor(element(by.id('recipe-detail-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Toggle favorite for recipe by index
   */
  async toggleFavoriteByIndex(index: number) {
    await this.getRecipeFavoriteButtonByIndex(index).tap();
  }

  /**
   * Add recipe ingredients to shopping list by index
   */
  async addRecipeToShoppingListByIndex(index: number) {
    await this.getRecipeAddToListButtonByIndex(index).tap();

    // Wait for confirmation or modal
    try {
      await waitFor(element(by.id('add-to-list-confirmation')))
        .toBeVisible()
        .withTimeout(2000);
      await this.tapByID('add-to-list-confirm-button');
    } catch {
      // No confirmation modal, ingredients added directly
    }
  }

  /**
   * Pull to refresh recipes
   */
  async pullToRefresh() {
    await this.getElementById(this.listContainer).swipe('down', 'fast', 0.75);
    await this.waitForElementToDisappear(this.refreshControl, 5000);
  }

  /**
   * Scroll to bottom of list
   */
  async scrollToBottom() {
    await this.scrollTo(this.listContainer, 'bottom');
  }

  /**
   * Scroll to top of list
   */
  async scrollToTop() {
    await this.scrollTo(this.listContainer, 'top');
  }

  /**
   * Expect empty state to be visible
   */
  async expectEmptyState() {
    await this.expectVisible(this.emptyState);
  }

  /**
   * Expect loading indicator to be visible
   */
  async expectLoadingVisible() {
    await this.expectVisible(this.loadingIndicator);
  }

  /**
   * Expect recipe to exist by index
   */
  async expectRecipeExists(index: number) {
    await expect(this.getRecipeByIndex(index)).toExist();
  }

  /**
   * Expect recipe to be visible by index
   */
  async expectRecipeVisible(index: number) {
    await expect(this.getRecipeByIndex(index)).toBeVisible();
  }

  /**
   * Expect recipe to have title
   */
  async expectRecipeTitle(index: number, title: string) {
    await expect(this.getRecipeTitleByIndex(index)).toHaveText(title);
  }

  /**
   * Expect recipe to be favorited
   */
  async expectRecipeFavorited(index: number) {
    // Assuming favorited state changes button appearance or has testID suffix
    await this.expectVisible(`recipe-card-${index}-favorite-button-active`);
  }

  /**
   * Expect recipe to not be favorited
   */
  async expectRecipeNotFavorited(index: number) {
    await this.expectNotVisible(`recipe-card-${index}-favorite-button-active`);
  }

  /**
   * Expect specific number of recipes
   */
  async expectRecipeCount(count: number) {
    for (let i = 0; i < count; i++) {
      await this.expectRecipeExists(i);
    }

    // Verify next recipe doesn't exist
    try {
      await expect(this.getRecipeByIndex(count)).not.toExist();
    } catch {
      throw new Error(`Expected ${count} recipes, but found more`);
    }
  }

  /**
   * Wait for recipes to load
   */
  async waitForListToLoad(timeout: number = 10000) {
    await this.waitForElementToDisappear(this.loadingIndicator, timeout);
  }

  /**
   * Expect search results message
   */
  async expectSearchResultsMessage(message: string) {
    await this.expectTextVisible(message);
  }

  /**
   * Expect no results found
   */
  async expectNoResultsFound() {
    await this.expectTextVisible('No recipes found');
  }
}
