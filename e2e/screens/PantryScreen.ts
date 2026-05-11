/**
 * PantryScreen
 *
 * Screen object model for the Pantry screen.
 * Provides methods for interacting with pantry inventory functionality.
 */

import { BaseScreen } from './BaseScreen';
import { element, by, waitFor, expect } from 'detox';

export class PantryScreen extends BaseScreen {
  protected screenID = 'pantry-screen';

  // Element IDs
  private readonly addButton = 'tab-bar-add-button';
  private readonly scanBarcodeButton = 'pantry-scan-barcode-button';
  private readonly listContainer = 'pantry-list';
  private readonly searchInput = 'pantry-search-input';
  private readonly filterButton = 'pantry-filter-button';
  private readonly sortButton = 'pantry-sort-button';
  private readonly emptyState = 'pantry-empty-state';
  private readonly loadingIndicator = 'pantry-loading';
  private readonly refreshControl = 'pantry-refresh-control';
  private readonly lowStockButton = 'pantry-low-stock-button';

  /**
   * Get item element by name (text-based lookup - reliable across data changes)
   * Source uses `pantry-item-${databaseId}` which is unpredictable in tests
   */
  getItemByText(name: string) {
    return element(by.text(name));
  }

  /**
   * Get item element by index (fallback - uses atIndex on list items)
   */
  private getItemByIndex(index: number) {
    return element(by.id(`pantry-item-${index}`));
  }

  private getItemDeleteButtonByIndex(index: number) {
    return element(by.id(`pantry-item-${index}-delete`));
  }

  private getItemExpirationByIndex(index: number) {
    return element(by.id(`pantry-item-${index}-expiration`));
  }

  private getItemQuantityByIndex(index: number) {
    return element(by.id(`pantry-item-${index}-quantity`));
  }

  /**
   * Navigate to pantry tab
   */
  async navigateToTab() {
    // Wait for tab bar to be ready (longer timeout after relaunch)
    await waitFor(element(by.id('tab-pantry')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('tab-pantry')).tap();
    // Use longer timeout since screen may take time to load data
    await this.waitForScreen(10000);
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

    // Wait for add button to be visible and tap it
    await waitFor(element(by.id(this.addButton)))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.id(this.addButton)).tap();
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
   * @param quantity - Can be number, fraction (e.g., "1 1/4"), or decimal (e.g., "0.25")
   */
  async addItem(
    name: string,
    quantity?: string | number,
    unit?: string,
    expirationDate?: string,
  ) {
    // Tap add button and wait for modal - retry once if needed
    await this.tapAddButton();

    // Wait for "Add Manually" button to appear (indicates modal is open)
    try {
      await waitFor(element(by.id('add-pantry-add-manually-button')))
        .toBeVisible()
        .withTimeout(3000);
    } catch {
      // Modal didn't open - retry the tap
      console.log('Modal did not open, retrying add button tap...');
      await this.tapAddButton();
      await waitFor(element(by.id('add-pantry-add-manually-button')))
        .toBeVisible()
        .withTimeout(3000);
    }
    await element(by.id('add-pantry-add-manually-button')).tap();

    // Wait for details modal to appear
    await waitFor(element(by.id('add-pantry-item-details-modal')))
      .toBeVisible()
      .withTimeout(5000);

    // Fill in item details
    // Use replaceText for item name to avoid Android stylus popup
    const nameInput = element(by.id('add-pantry-item-name-input'));
    await nameInput.replaceText(name);

    // Wait for autocomplete bottom sheet animation
    await waitFor(element(by.id('add-pantry-item-name-input')))
      .toBeVisible()
      .withTimeout(1000);

    // Press enter to confirm and close the autocomplete
    await element(by.id('add-pantry-item-name-input')).tapReturnKey();

    if (quantity !== undefined) {
      // Type the quantity (supports fractions like "1 1/4" or "0.25")
      const quantityStr = typeof quantity === 'number' ? quantity.toString() : quantity;
      const quantityInput = element(by.id('add-pantry-item-quantity-input'));

      // Use replaceText instead of clearAndType for better reliability
      await quantityInput.replaceText(quantityStr);
    }

    if (unit) {
      // Use replaceText for unit to avoid Android stylus popup
      const unitInput = element(by.id('add-pantry-item-unit-picker'));
      await unitInput.replaceText(unit);

      // Press enter to confirm the unit and dismiss autocomplete
      await element(by.id('add-pantry-item-unit-picker')).tapReturnKey();

      // Wait for autocomplete to process and dismiss
      await new Promise(resolve => setTimeout(resolve, 500));

      // Tap on the modal background to dismiss any remaining autocomplete dropdown
      try {
        await element(by.id('add-pantry-item-details-modal')).tap({ x: 10, y: 10 });
      } catch {
        // Modal tap failed, continue anyway
      }

      // Wait for keyboard and autocomplete to fully dismiss
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (expirationDate) {
      await this.tapByID('add-pantry-item-expiration-picker');
      // Date picker interaction would be platform-specific
      await this.tapByText(expirationDate);
    }

    // Submit - tap Return should have dismissed keyboard already
    await this.tapByID('add-pantry-item-submit-button');

    // Check if error modal appeared (e.g., "Please enter a valid quantity")
    try {
      await waitFor(element(by.text('Please enter a valid quantity')))
        .toBeVisible()
        .withTimeout(2000);

      // Error modal appeared - dismiss it and throw error
      await element(by.text('OK')).tap();
      throw new Error(
        `Failed to add pantry item: Invalid quantity "${quantity}". ` +
        `Expected formats: "1", "1.5", "1/4", or "1 1/4"`
      );
    } catch (error) {
      // If it's our thrown error, re-throw it
      if (error instanceof Error && error.message.includes('Failed to add pantry item')) {
        throw error;
      }
      // Otherwise, error modal didn't appear (good!), continue
    }

    // Wait for details modal to disappear first (navigation started)
    // Increased timeout to 15s to account for GraphQL mutation + Apollo cache updates
    await waitFor(element(by.id('add-pantry-item-details-modal')))
      .not.toBeVisible()
      .withTimeout(15000);

    // Wait for screen to navigate back to pantry main
    await waitFor(element(by.id('pantry-screen')))
      .toBeVisible()
      .withTimeout(5000);
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
