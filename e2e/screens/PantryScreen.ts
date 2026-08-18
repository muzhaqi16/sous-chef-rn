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
  private readonly listContainer = 'pantry-list';
  private readonly searchInput = 'pantry-search-input';
  private readonly sortButton = 'pantry-sort-button';
  private readonly emptyState = 'pantry-empty-state';
  private readonly loadingIndicator = 'pantry-loading';
  private readonly refreshControl = 'pantry-refresh-control';

  /**
   * Page index of the add-details sheet's "Details" tab.
   *
   * Quantity and unit live here (`DetailsPage.tsx`), NOT on "Stock" — the tab
   * labels do not map to where the fields are, and `StockSettingsPage` holds
   * low-stock thresholds instead.
   */
  private static readonly FORM_PAGE_DETAILS = 1;

  /**
   * Open the add-details sheet, through the picker sheet that precedes it.
   *
   * Both taps are retried: landing either while the sheet above it is still
   * animating gets it swallowed, which made this flow pass on one run and fail
   * on the next.
   */
  async openAddDetailsForm() {
    await this.tapAddButton();

    try {
      await waitFor(element(by.id('add-pantry-item-add-manually-button')))
        .toBeVisible()
        .withTimeout(3000);
    } catch {
      await this.tapAddButton();
      await waitFor(element(by.id('add-pantry-item-add-manually-button')))
        .toBeVisible()
        .withTimeout(3000);
    }

    await element(by.id('add-pantry-item-add-manually-button')).tap();
    try {
      await waitFor(element(by.id('add-pantry-item-name-input')))
        .toBeVisible()
        .withTimeout(5000);
    } catch {
      await element(by.id('add-pantry-item-add-manually-button')).tap();
      await waitFor(element(by.id('add-pantry-item-name-input')))
        .toBeVisible()
        .withTimeout(5000);
    }
  }

  /**
   * Close the item-name autocomplete dropdown if it is still open.
   *
   * Tapping the sheet's own container is the reliable dismissal: it is always
   * present, and a tap near its top-left lands on chrome rather than on a
   * field. Best-effort — when no dropdown is open the tap is harmless.
   */
  async dismissNameAutocomplete() {
    try {
      await element(by.id('add-pantry-item-details-modal')).tap({ x: 10, y: 10 });
    } catch {
      // Nothing open, or the container moved — the caller's own waits will
      // report anything that actually matters.
    }
  }

  /**
   * Back out of the add flow entirely.
   *
   * Cancel on the details sheet does not return to the pantry — it returns to
   * the picker sheet ("Add to Pantry") that opened it, and THAT still covers
   * the list. Both have to go, or the next test starts with a sheet up: the
   * exact state leak that made one failure report as nine.
   */
  async cancelAddDetailsForm() {
    await element(by.id('add-pantry-item-cancel-button')).tap();

    // Cancel usually drops back to the picker sheet, but not always — whether
    // it also closes depends on how the two sheets' dismiss animations
    // overlap. So dismiss it only if it is actually there, and let the
    // `waitForScreen` below be the assertion either way.
    try {
      await waitFor(element(by.id('add-pantry-item-modal')))
        .toBeVisible()
        .withTimeout(2000);
      await element(by.id('add-pantry-item-modal')).swipe('down', 'fast', 0.9);
    } catch {
      // Already gone.
    }

    await this.waitForScreen();
  }

  /**
   * Swipe a row open and delete it.
   *
   * `RightActions` composes `${testIDPrefix}-delete`, and a pantry row's prefix
   * is `pantry-item-<entity id>` — unknown here, hence the regex. Only the
   * swiped row has its actions mounted, so `atIndex(0)` is unambiguous.
   */
  async deleteItemByName(name: string) {
    await this.expectItemInPantry(name);
    await element(by.text(name)).swipe('left', 'fast', 0.7);

    const deleteButton = element(by.id(/^pantry-item-.+-delete$/)).atIndex(0);
    await waitFor(deleteButton).toBeVisible().withTimeout(5000);
    await deleteButton.tap();

    await waitFor(element(by.text(name)))
      .not.toBeVisible()
      .withTimeout(10000);
  }

  /**
   * Move the paged item form to a given page via its PageIndicator.
   *
   * Targeted by index rather than label: the labels are translated, so a
   * label-based matcher would pass in English and fail in every other locale.
   */
  async goToFormPage(index: number) {
    await element(by.id(`add-pantry-item-page-${index}`)).tap();
  }

  /**
   * Assert a row is in the pantry list, scrolling to reach it.
   *
   * A bare `toBeVisible()` on the row text only passes while the row happens to
   * be on screen. A freshly added item lands wherever the current sort puts it,
   * and with a seeded pantry that is usually below the fold — so the assertion
   * failed for a row that had been added perfectly well (the header count went
   * up each time). `whileElement(...).scroll()` searches the list instead of
   * assuming the row is already in view.
   */
  async expectItemInPantry(name: string, timeout = 5000) {
    await waitFor(element(by.text(name)))
      .toBeVisible()
      .whileElement(by.id(this.listContainer))
      .scroll(400, 'down', NaN, 0.85);
    await waitFor(element(by.text(name))).toBeVisible().withTimeout(timeout);
  }

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
   * Add new item to pantry
   * @param quantity - Can be number, fraction (e.g., "1 1/4"), or decimal (e.g., "0.25")
   */
  async addItem(
    name: string,
    quantity?: string | number,
    unit?: string,
    expirationDate?: string,
  ) {
    await this.openAddDetailsForm();

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

    // …and make sure it really closed. The item-name field is an autocomplete;
    // its dropdown overlays the rest of the sheet, so while it is open the page
    // indicator and the Cancel button are covered. That surfaces as
    // "View is not hittable at its visible point" on Cancel, and as a page tap
    // that silently does nothing — after which a field on the target page is
    // reported MISSING because the page never changed.
    await this.dismissNameAutocomplete();

    if (quantity !== undefined || unit) {
      // The sheet is PAGED — Main / Details / Storage / Stock — inside a
      // PagerView, so a field on another page is UNMOUNTED, not merely
      // off-screen. That is why Detox reported "No elements found" rather than
      // a visibility timeout, and why the tests, which treated this as one long
      // scrolling form, could never have passed.
      await this.goToFormPage(PantryScreen.FORM_PAGE_DETAILS);

      // Wait for the page to finish mounting. `PagerView` animates the change,
      // and the fields on the incoming page do not exist until it settles — so
      // looking one up immediately reports "No elements found" even though the
      // tap worked and the page is on its way in.
      await waitFor(element(by.id('add-pantry-item-quantity-input')))
        .toBeVisible()
        .withTimeout(5000);
    }

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
    // See the note above: wait on the name input, which only the form has.
    await waitFor(element(by.id('add-pantry-item-name-input')))
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
