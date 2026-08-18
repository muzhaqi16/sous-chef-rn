/**
 * ShoppingListScreen
 *
 * Screen object model for the Shopping List screen.
 * Provides methods for interacting with shopping list functionality.
 */

import { BaseScreen } from './BaseScreen';
import { element, by, waitFor, expect } from 'detox';
import { expectDisappearsAfter } from '../helpers/assertions';

export class ShoppingListScreen extends BaseScreen {
  protected screenID = 'shopping-list-screen';

  // Element IDs
  private readonly addButton = 'tab-bar-add-button';
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
    console.log('📱 Navigating to Shopping List tab...');
    // Wait for tab bar to be ready (longer timeout after relaunch)
    await waitFor(element(by.id('tab-shoppinglist')))
      .toBeVisible()
      .withTimeout(10000);
    console.log('✓ Shopping list tab found, tapping...');
    await element(by.id('tab-shoppinglist')).tap();
    console.log('✓ Tapped shopping list tab, waiting for screen...');

    // Wait for screen with retry on failure
    try {
      await this.waitForScreen(5000);
    } catch {
      console.log('Screen not visible, retrying tab tap...');
      await element(by.id('tab-shoppinglist')).tap();
      await this.waitForScreen(10000);
    }
    console.log('✓ Shopping list screen visible');
  }

  /**
   * Tap add button to add new item
   * Also handles dismissing the feature hint overlay if it appears
   */
  async tapAddButton() {
    // Try to dismiss feature hint overlay if it exists (appears once per session when items exist)
    try {
      await waitFor(element(by.id('feature-hint-overlay-dismiss')))
        .toBeVisible()
        .withTimeout(1000);
      await element(by.id('feature-hint-overlay-dismiss')).tap();
      await waitFor(element(by.id('feature-hint-overlay')))
        .not.toBeVisible()
        .withTimeout(2000);
    } catch {
      // Overlay not present, continue
    }

    await this.tapByID(this.addButton);
  }

  /**
   * Add new item to shopping list
   * @param quantity - Can be number, fraction (e.g., "1 1/4"), or decimal (e.g., "0.25")
   */
  async addItem(name: string, quantity?: string | number, unit?: string) {
    // Tap add button and wait for modal - retry once if needed
    await this.tapAddButton();

    // Wait for "Add Manually" button to appear (indicates sheet is open)
    try {
      await waitFor(element(by.id('add-shopping-item-add-manually-button')))
        .toBeVisible()
        .withTimeout(3000);
    } catch {
      // Modal didn't open - retry the tap
      console.log('Modal did not open, retrying add button tap...');
      await this.tapAddButton();
      await waitFor(element(by.id('add-shopping-item-add-manually-button')))
        .toBeVisible()
        .withTimeout(3000);
    }
    // Retry the tap, and wait on the NAME INPUT rather than
    // `add-shopping-item-modal`. That id belongs to the picker sheet
    // (`AddItemSheet` renders `${config.testIDPrefix}-modal`), which this tap
    // navigates AWAY from — so waiting for it after the tap can only time out.
    // Landing the tap mid-animation also gets it swallowed, which made the
    // flow pass on one run and fail on the next.
    await element(by.id('add-shopping-item-add-manually-button')).tap();
    try {
      await waitFor(element(by.id('add-shopping-item-name-input')))
        .toBeVisible()
        .withTimeout(5000);
    } catch {
      console.log('Details step did not open, retrying "Add Manually" tap...');
      await element(by.id('add-shopping-item-add-manually-button')).tap();
      await waitFor(element(by.id('add-shopping-item-name-input')))
        .toBeVisible()
        .withTimeout(5000);
    }

    // Fill in item details - use replaceText to avoid Android stylus popup
    const nameInput = element(by.id('add-shopping-item-name-input'));
    await nameInput.replaceText(name);

    if (quantity !== undefined) {
      const quantityStr =
        typeof quantity === 'number' ? quantity.toString() : quantity;
      const quantityInput = element(by.id('add-shopping-item-quantity-input'));

      // Use replaceText instead of clearAndType for better reliability
      await quantityInput.replaceText(quantityStr);
    }

    if (unit) {
      // Use replaceText for unit to avoid Android stylus popup
      const unitInput = element(by.id('add-shopping-item-unit-picker'));
      await unitInput.replaceText(unit);

      // Press enter to confirm the unit
      await element(by.id('add-shopping-item-unit-picker')).tapReturnKey();

      // Wait for autocomplete to process
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Tap outside inputs to dismiss keyboard and ensure submit button is accessible
    // The modal container is safe to tap without closing the modal
    await element(by.id('add-shopping-item-modal')).tap({ x: 10, y: 10 });

    // Wait for keyboard to fully dismiss
    await new Promise(resolve => setTimeout(resolve, 500));

    // Submit - tap the checkmark button in the header
    await this.tapByID('add-shopping-item-submit-button');

    // Check if error modal appeared (e.g., "Please enter a valid quantity")
    try {
      await waitFor(element(by.text('Please enter a valid quantity')))
        .toBeVisible()
        .withTimeout(2000);

      // Error modal appeared - dismiss it and throw error
      await element(by.text('OK')).tap();
      throw new Error(
        `Failed to add shopping list item: Invalid quantity "${quantity}". ` +
          `Expected formats: "1", "1.5", "1/4", or "1 1/4"`,
      );
    } catch (error) {
      // If it's our thrown error, re-throw it
      if (
        error instanceof Error &&
        error.message.includes('Failed to add shopping list item')
      ) {
        throw error;
      }
      // Otherwise, error modal didn't appear (good!), continue
    }

    // Wait for modal to close (15s max to account for GraphQL mutation + Apollo cache updates)
    await waitFor(element(by.id('add-shopping-item-modal')))
      .not.toBeVisible()
      .withTimeout(15000);

    // Dismiss feature hint overlay if it appears (shown after first item added)
    try {
      await waitFor(element(by.id('feature-hint-overlay-dismiss')))
        .toBeVisible()
        .withTimeout(2000);
      await element(by.id('feature-hint-overlay-dismiss')).tap();
      await waitFor(element(by.id('feature-hint-overlay')))
        .not.toBeVisible()
        .withTimeout(2000);
    } catch {
      // Overlay not present, continue
    }

    // Wait for screen to navigate back to shopping list main
    await waitFor(element(by.id('shopping-list-screen')))
      .toBeVisible()
      .withTimeout(5000);
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
    await waitFor(element(by.id('edit-item-modal')))
      .toBeVisible()
      .withTimeout(3000);

    await this.clearAndType('edit-item-name-input', newName);

    // The editor is gone when its name field is gone. That field was just typed
    // into, so it is proven matchable — a disappearance check against it cannot
    // pass because the matcher found nothing, which is how `edit-item-modal`
    // reported a still-open editor as closed.
    await expectDisappearsAfter('edit-item-name-input', () =>
      this.tapByID('edit-item-submit-button'),
    );
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
