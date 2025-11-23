/**
 * PantryScreen
 *
 * Screen object model for the Pantry screen.
 * Provides methods for interacting with pantry inventory functionality.
 */

import { BaseScreen } from './BaseScreen';
import { element, by, waitFor } from 'detox';

export class PantryScreen extends BaseScreen {
  protected screenID = 'pantry-screen';

  // Element IDs
  private readonly addButton = 'pantry-add-button';
  private readonly scanBarcodeButton = 'pantry-scan-barcode-button';
  private readonly listContainer = 'pantry-list';
  private readonly searchInput = 'pantry-search-input';
  private readonly filterButton = 'pantry-filter-button';
  private readonly sortButton = 'pantry-sort-button';
  private readonly emptyState = 'pantry-empty-state';
  private readonly loadingIndicator = 'pantry-loading';
  private readonly refreshControl = 'pantry-refresh-control';
  private readonly expiringItemsButton = 'pantry-expiring-items-button';
  private readonly lowStockButton = 'pantry-low-stock-button';

  /**
   * Get item element by index
   */
  private getItemByIndex(index: number) {
    return element(by.id(`pantry-item-${index}`));
  }

  /**
   * Get item element by name
   */
  private getItemByName(name: string) {
    return element(by.id(`pantry-item-${name}`));
  }

  /**
   * Get item delete button by index
   */
  private getItemDeleteButtonByIndex(index: number) {
    return element(by.id(`pantry-item-${index}-delete`));
  }

  /**
   * Get item edit button by index
   */
  private getItemEditButtonByIndex(index: number) {
    return element(by.id(`pantry-item-${index}-edit`));
  }

  /**
   * Get item expiration date by index
   */
  private getItemExpirationByIndex(index: number) {
    return element(by.id(`pantry-item-${index}-expiration`));
  }

  /**
   * Get item quantity by index
   */
  private getItemQuantityByIndex(index: number) {
    return element(by.id(`pantry-item-${index}-quantity`));
  }

  /**
   * Navigate to pantry tab
   */
  async navigateToTab() {
    await this.tapByID('tab-pantry');
    await this.waitForScreen();
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
   * Tap scan barcode button
   */
  async tapScanBarcodeButton() {
    await this.tapByID(this.scanBarcodeButton);
    // Wait for camera/scanner screen
    await waitFor(element(by.id('barcode-scanner-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Add new item to pantry
   */
  async addItem(
    name: string,
    quantity?: number,
    unit?: string,
    expirationDate?: string,
  ) {
    await this.tapAddButton();

    // Wait for add item modal/screen
    await waitFor(element(by.id('add-pantry-item-modal')))
      .toBeVisible()
      .withTimeout(3000);

    // Fill in item details
    // Type item name - this will trigger item autocomplete bottom sheet
    await this.clearAndType('add-pantry-item-name-input', name);

    // Wait for autocomplete bottom sheet to open
    await new Promise(resolve => setTimeout(resolve, 500));

    // Press enter to confirm and close the autocomplete
    await element(by.id('add-pantry-item-name-input')).tapReturnKey();

    // Wait for autocomplete to dismiss
    await new Promise(resolve => setTimeout(resolve, 800));

    if (quantity !== undefined) {
      // Tap into the quantity field first to ensure it has focus
      await this.tapByID('add-pantry-item-quantity-input');

      // Wait a moment for focus
      await new Promise(resolve => setTimeout(resolve, 200));

      // Now type the quantity
      await this.clearAndType(
        'add-pantry-item-quantity-input',
        quantity.toString(),
      );
      // Wait a moment to ensure quantity is committed before moving to unit field
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (unit) {
      // Type into the unit picker input - this will trigger the autocomplete bottom sheet to open
      // when text length >= 2 (minSearchLength)
      await this.clearAndType('add-pantry-item-unit-picker', unit);

      // The bottom sheet should now be open with the search input
      // Wait a moment for the bottom sheet animation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Press enter to confirm the unit
      await element(by.id('add-pantry-item-unit-picker')).tapReturnKey();

      // Wait for the bottom sheet to fully dismiss
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (expirationDate) {
      await this.tapByID('add-pantry-item-expiration-picker');
      // Date picker interaction would be platform-specific
      await this.tapByText(expirationDate);
    }

    // Submit - use regular tap now that KeyboardAvoidingView testID is fixed
    await element(by.id('add-pantry-item-submit-button')).tap();
    await expect(element(by.id('add-pantry-item-submit-button'))).toBeVisible();

    // Wait for screen to navigate back to pantry main (increased timeout for GraphQL mutation + navigation)
    await waitFor(element(by.id('pantry-screen')))
      .toBeVisible()
      .withTimeout(15000);
  }

  /**
   * Edit item by index
   */
  async editItemByIndex(
    index: number,
    updates: {
      name?: string;
      quantity?: number;
      expirationDate?: string;
    },
  ) {
    await this.getItemByIndex(index).tap();

    // Wait for edit modal
    await waitFor(element(by.id('edit-pantry-item-modal')))
      .toBeVisible()
      .withTimeout(3000);

    if (updates.name) {
      await this.clearAndType('edit-pantry-item-name-input', updates.name);
    }

    if (updates.quantity !== undefined) {
      await this.clearAndType(
        'edit-pantry-item-quantity-input',
        updates.quantity.toString(),
      );
    }

    if (updates.expirationDate) {
      await this.tapByID('edit-pantry-item-expiration-picker');
      await this.tapByText(updates.expirationDate);
    }

    await this.tapByID('edit-pantry-item-submit-button');

    // Wait for modal to close
    await waitFor(element(by.id('edit-pantry-item-modal')))
      .not.toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Delete item by index (swipe to delete)
   */
  async swipeToDeleteItem(index: number) {
    await this.getItemByIndex(index).swipe('left', 'fast');
    await this.getItemDeleteButtonByIndex(index).tap();
  }

  /**
   * Navigate to expiring items view
   */
  async navigateToExpiringItems() {
    await this.tapByID(this.expiringItemsButton);
    await waitFor(element(by.id('expiring-items-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Navigate to low stock items view
   */
  async navigateToLowStockItems() {
    await this.tapByID(this.lowStockButton);
    await waitFor(element(by.id('low-stock-items-screen')))
      .toBeVisible()
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
   * Expect item to have name
   */
  async expectItemName(index: number, name: string) {
    await expect(this.getItemByIndex(index)).toHaveText(name);
  }

  /**
   * Expect item to have expiration date
   */
  async expectItemExpiration(index: number, date: string) {
    await expect(this.getItemExpirationByIndex(index)).toHaveText(date);
  }

  /**
   * Expect item to have quantity
   */
  async expectItemQuantity(index: number, quantity: string) {
    await expect(this.getItemQuantityByIndex(index)).toHaveText(quantity);
  }

  /**
   * Expect item to be expiring soon (has warning indicator)
   */
  async expectItemExpiringSoon(index: number) {
    await this.expectVisible(`pantry-item-${index}-expiring-warning`);
  }

  /**
   * Expect item to be low stock (has warning indicator)
   */
  async expectItemLowStock(index: number) {
    await this.expectVisible(`pantry-item-${index}-low-stock-warning`);
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
   * Increase item quantity
   */
  async increaseQuantity(index: number) {
    await this.tapByID(`pantry-item-${index}-increase-quantity`);
  }

  /**
   * Decrease item quantity
   */
  async decreaseQuantity(index: number) {
    await this.tapByID(`pantry-item-${index}-decrease-quantity`);
  }
}
