/**
 * ShoppingListScreen
 *
 * Screen object model for the Shopping List screen.
 * Provides methods for interacting with shopping list functionality.
 */

import { BaseScreen } from './BaseScreen';
import { element, by, waitFor } from 'detox';

export class ShoppingListScreen extends BaseScreen {
  protected screenID = 'shopping-list-screen';

  // Element IDs
  private readonly addButton = 'shopping-list-add-button';
  private readonly listContainer = 'shopping-list';
  private readonly searchInput = 'shopping-list-search-input';
  private readonly filterButton = 'shopping-list-filter-button';
  private readonly sortButton = 'shopping-list-sort-button';
  private readonly emptyState = 'shopping-list-empty-state';
  private readonly loadingIndicator = 'shopping-list-loading';
  private readonly refreshControl = 'shopping-list-refresh-control';

  /**
   * Get item element by index
   */
  private getItemByIndex(index: number) {
    return element(by.id(`shopping-list-item-${index}`));
  }

  /**
   * Get item element by name
   */
  private getItemByName(name: string) {
    return element(by.id(`shopping-list-item-${name}`));
  }

  /**
   * Get item checkbox by index
   */
  private getItemCheckboxByIndex(index: number) {
    return element(by.id(`shopping-list-item-${index}-checkbox`));
  }

  /**
   * Get item delete button by index
   */
  private getItemDeleteButtonByIndex(index: number) {
    return element(by.id(`shopping-list-item-${index}-delete`));
  }

  /**
   * Get item edit button by index
   */
  private getItemEditButtonByIndex(index: number) {
    return element(by.id(`shopping-list-item-${index}-edit`));
  }

  /**
   * Navigate to tab (assuming bottom tab navigation)
   * Note: Tab testID is 'tab-shoppinglist' (no dash) based on route name 'ShoppingList'
   */
  async navigateToTab() {
    await this.tapByID('tab-shoppinglist');
    await this.waitForScreen();
  }

  /**
   * Tap add button to add new item
   */
  async tapAddButton() {
    await this.tapByID(this.addButton);
  }

  /**
   * Add new item to shopping list
   */
  async addItem(name: string, quantity?: number, unit?: string) {
    await this.tapAddButton();

    // Wait for add item modal/screen
    await waitFor(element(by.id('add-item-modal'))).toBeVisible().withTimeout(3000);

    // Fill in item details
    await this.clearAndType('add-item-name-input', name);

    if (quantity !== undefined) {
      await this.clearAndType('add-item-quantity-input', quantity.toString());
    }

    if (unit) {
      // Type into the unit picker input - this will trigger the autocomplete bottom sheet to open
      // when text length >= 2 (minSearchLength)
      await this.clearAndType('add-item-unit-picker', unit);

      // The bottom sheet should now be open with the search input
      // Wait a moment for the bottom sheet animation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Press enter to confirm the unit
      await element(by.id('add-item-unit-picker')).tapReturnKey();

      // Wait for the bottom sheet to fully dismiss
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Submit
    await this.tapByID('add-item-submit-button');

    // Wait for modal to close (increased timeout for GraphQL mutation)
    await waitFor(element(by.id('add-item-modal')))
      .not.toBeVisible()
      .withTimeout(10000);
  }

  /**
   * Check/toggle item by index
   */
  async toggleItemByIndex(index: number) {
    await this.getItemCheckboxByIndex(index).tap();
  }

  /**
   * Swipe to delete item by index
   */
  async swipeToDeleteItem(index: number) {
    await this.getItemByIndex(index).swipe('left', 'fast');
    await this.getItemDeleteButtonByIndex(index).tap();
  }

  /**
   * Edit item by index
   */
  async editItemByIndex(index: number, newName: string) {
    await this.getItemByIndex(index).tap();

    // Wait for edit modal
    await waitFor(element(by.id('edit-item-modal'))).toBeVisible().withTimeout(3000);

    await this.clearAndType('edit-item-name-input', newName);
    await this.tapByID('edit-item-submit-button');

    // Wait for modal to close
    await waitFor(element(by.id('edit-item-modal')))
      .not.toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Search for items
   */
  async searchFor(query: string) {
    await this.clearAndType(this.searchInput, query);
    await this.dismissKeyboard();
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
  }

  /**
   * Open sort menu
   */
  async openSort() {
    await this.tapByID(this.sortButton);
  }

  /**
   * Pull to refresh list
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
   * Expect item to exist by index
   */
  async expectItemExists(index: number) {
    await expect(this.getItemByIndex(index)).toExist();
  }

  /**
   * Expect item to be visible by index
   */
  async expectItemVisible(index: number) {
    await expect(this.getItemByIndex(index)).toBeVisible();
  }

  /**
   * Expect item to have text
   */
  async expectItemText(index: number, text: string) {
    await expect(this.getItemByIndex(index)).toHaveText(text);
  }

  /**
   * Expect item to be checked
   */
  async expectItemChecked(index: number) {
    await expect(this.getItemCheckboxByIndex(index)).toHaveToggleValue(true);
  }

  /**
   * Expect item to be unchecked
   */
  async expectItemUnchecked(index: number) {
    await expect(this.getItemCheckboxByIndex(index)).toHaveToggleValue(false);
  }

  /**
   * Expect specific number of items in list
   */
  async expectItemCount(count: number) {
    for (let i = 0; i < count; i++) {
      await this.expectItemExists(i);
    }

    // Verify next item doesn't exist
    try {
      await expect(this.getItemByIndex(count)).not.toExist();
    } catch {
      // If element exists, count is wrong
      throw new Error(`Expected ${count} items, but found more`);
    }
  }

  /**
   * Wait for list to load
   */
  async waitForListToLoad(timeout: number = 10000) {
    await this.waitForElementToDisappear(this.loadingIndicator, timeout);
  }

  /**
   * Long press on item
   */
  async longPressItem(index: number, duration: number = 1000) {
    await this.getItemByIndex(index).longPress(duration);
  }

  /**
   * Drag item from one index to another (for reordering)
   */
  async dragItem(fromIndex: number, toIndex: number) {
    const fromElement = this.getItemByIndex(fromIndex);
    const toElement = this.getItemByIndex(toIndex);

    await fromElement.longPress();
    // Note: Detox doesn't have native drag-and-drop API
    // This may need platform-specific implementation
    await toElement.tap();
  }
}
