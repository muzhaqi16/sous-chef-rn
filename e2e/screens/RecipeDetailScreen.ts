/**
 * RecipeDetailScreen
 *
 * Screen object model for the Recipe Detail screen.
 * Provides methods for interacting with individual recipe details.
 */

import { BaseScreen } from './BaseScreen';
import { element, by, waitFor, expect } from 'detox';

export class RecipeDetailScreen extends BaseScreen {
  protected screenID = 'recipe-detail-screen';

  // Element IDs
  private readonly favoriteButton = 'recipe-detail-favorite-button';
  private readonly addToListButton = 'recipe-detail-add-to-list-button';
  private readonly ingredientsList = 'recipe-detail-ingredients-list';
  private readonly instructionsList = 'recipe-detail-instructions-list';
  private readonly servingsControl = 'recipe-detail-servings-control';
  private readonly backButton = 'recipe-detail-back-button';
  private readonly shareButton = 'recipe-detail-share-button';

  /**
   * Toggle favorite status
   */
  async toggleFavorite() {
    await this.tapByID(this.favoriteButton);
  }

  /**
   * Add recipe ingredients to shopping list
   */
  async addToShoppingList() {
    await this.tapByID(this.addToListButton);

    // Wait for confirmation modal or success message
    try {
      await waitFor(element(by.id('add-to-list-confirmation')))
        .toBeVisible()
        .withTimeout(2000);
      await this.tapByID('add-to-list-confirm-button');
    } catch {
      // No confirmation modal needed
    }
  }

  /**
   * Navigate back
   */
  async goBack() {
    try {
      await this.tapByID(this.backButton);
    } catch {
      await super.goBack();
    }
  }

  /**
   * Share recipe
   */
  async shareRecipe() {
    await this.tapByID(this.shareButton);
  }

  /**
   * Expect recipe title
   */
  async expectTitle(title: string) {
    await this.expectTextVisible(title);
  }

  /**
   * Expect ingredients list to be visible
   */
  async expectIngredientsVisible() {
    await this.expectVisible(this.ingredientsList);
  }

  /**
   * Expect instructions list to be visible
   */
  async expectInstructionsVisible() {
    await this.expectVisible(this.instructionsList);
  }

  /**
   * Expect favorite button to be visible
   */
  async expectFavoriteButtonVisible() {
    await this.expectVisible(this.favoriteButton);
  }

  /**
   * Expect recipe to be favorited (active state)
   */
  async expectFavorited() {
    await this.expectVisible(`${this.favoriteButton}-active`);
  }

  /**
   * Expect recipe to not be favorited
   */
  async expectNotFavorited() {
    await this.expectNotVisible(`${this.favoriteButton}-active`);
  }

  /**
   * Get ingredient by index
   */
  private getIngredientByIndex(index: number) {
    return element(by.id(`recipe-ingredient-${index}`));
  }

  /**
   * Expect ingredient to exist
   */
  async expectIngredientExists(index: number) {
    await expect(this.getIngredientByIndex(index)).toExist();
  }

  /**
   * Expect ingredient text
   */
  async expectIngredientText(index: number, text: string) {
    await expect(this.getIngredientByIndex(index)).toHaveText(text);
  }

  /**
   * Scroll to bottom of recipe
   */
  async scrollToBottom() {
    await this.scrollTo(this.screenID, 'bottom');
  }

  /**
   * Scroll to top of recipe
   */
  async scrollToTop() {
    await this.scrollTo(this.screenID, 'top');
  }

  /**
   * Adjust servings
   */
  async adjustServings(increase: boolean) {
    const buttonId = increase
      ? 'recipe-detail-servings-increase'
      : 'recipe-detail-servings-decrease';
    await this.tapByID(buttonId);
  }
}
