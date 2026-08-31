/** Screen object model for the Pantry screen. */

import { BaseScreen } from './BaseScreen';
import { element, by, waitFor, expect } from 'detox';

export class PantryScreen extends BaseScreen {
  protected screenID = 'pantry-screen';

  // Element IDs
  private readonly addButton = 'tab-bar-add-button';
  private readonly listContainer = 'pantry-list';
  private readonly searchInput = 'pantry-search-input';

  /** Last field filled here, so it is the one holding the keyboard. */
  protected keyboardInput = this.searchInput;
  private readonly sortButton = 'pantry-sort-button';
  private readonly emptyState = 'pantry-empty-state';
  private readonly loadingIndicator = 'pantry-loading';
  private readonly refreshControl = 'pantry-refresh-control';

  /**
   * Page index of the add-details sheet's "Details" tab. Quantity and unit live
   * here (`DetailsPage.tsx`), NOT on "Stock" — the tab labels do not map to where
   * the fields are; `StockSettingsPage` holds low-stock thresholds.
   */
  private static readonly FORM_PAGE_DETAILS = 1;

  /**
   * Open the add-details sheet through the picker sheet that precedes it. Both
   * taps are retried: one landing while the sheet above is still animating gets
   * swallowed with no error.
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
   * Close the item-name autocomplete dropdown if open. Tapping the sheet's own
   * container is the reliable dismissal — always present, and a tap near its
   * top-left lands on chrome, not a field. Harmless when nothing is open.
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
   * Back out of the add flow entirely. Cancel on the details sheet returns to the
   * picker sheet ("Add to Pantry") that opened it, not to the pantry, and THAT
   * still covers the list — both have to go or the next test starts with a sheet up.
   */
  async cancelAddDetailsForm() {
    await element(by.id('add-pantry-item-cancel-button')).tap();

    // Whether cancel also closes the picker sheet depends on how the two dismiss
    // animations overlap, so dismiss it only if present and let `waitForScreen`
    // be the assertion either way.
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
   * Swipe a row open and delete it. `SwipeableItem` composes each action's testID
   * as `${testIDPrefix}-${action.key}`, and a pantry row's prefix is
   * `pantry-item-<entity id>` — unknown here, hence the regex.
   */
  async deleteItemByName(name: string) {
    // Two attempts: a swipe can spring back instead of latching, leaving the tap
    // on a closed row; and `by.id(/^pantry-item-.+-delete$/).atIndex(0)` takes the
    // first match in the hierarchy, which is not necessarily the row just swiped
    // — FlashList decides what is mounted. Both no-op and report identically.
    for (let attempt = 0; attempt < 2; attempt++) {
      await this.expectItemInPantry(name);
      await element(by.text(name)).swipe('left', 'fast', 0.7);

      const deleteButton = element(by.id(/^pantry-item-.+-delete$/)).atIndex(0);
      await waitFor(deleteButton).toBeVisible().withTimeout(5000);
      await deleteButton.tap();

      try {
        await waitFor(element(by.text(name)))
          .not.toBeVisible()
          .withTimeout(10000);
        return;
      } catch (error) {
        // Out of attempts — report the original expectation failure rather than
        // a synthesized one, so the message still names the row and the matcher.
        if (attempt === 1) {
          throw error;
        }
      }
    }
  }

  /**
   * Move the paged item form to a page via its PageIndicator. Targeted by index,
   * not label: the labels are translated, so a label matcher passes in English
   * and fails in every other locale.
   */
  async goToFormPage(index: number) {
    await element(by.id(`add-pantry-item-page-${index}`)).tap();
  }

  /**
   * Assert a row is in the pantry list, scrolling to reach it. A bare
   * `toBeVisible()` only passes while the row happens to be on screen, and a
   * freshly added item lands wherever the sort puts it — usually below the fold
   * in a seeded pantry. `whileElement(...).scroll()` searches instead.
   */
  async expectItemInPantry(name: string, timeout = 5000) {
    // Try the top first: a just-added row is row 0 under a newest-first sort, and
    // the STICKY filter tabs pin over it on any scroll, clipping it below Detox's
    // 75% visibility threshold. That reads as "not visible" for a row on screen
    // the whole time, and scrolling DOWN makes it worse. The top unpins the header.
    try {
      await element(by.id(this.listContainer)).scrollTo('top');
      await waitFor(element(by.text(name)))
        .toBeVisible()
        .withTimeout(timeout);
      return;
    } catch {
      // Not at the top — fall through to searching downwards, which is what a
      // row under any other sort order needs.
    }

    await waitFor(element(by.text(name)))
      .toBeVisible()
      .whileElement(by.id(this.listContainer))
      .scroll(400, 'down', NaN, 0.85);
    await waitFor(element(by.text(name))).toBeVisible().withTimeout(timeout);
  }

  /** By text: the app keys rows `pantry-item-${databaseId}`, unpredictable in tests. */
  getItemByText(name: string) {
    return element(by.text(name));
  }

  private getItemByIndex(index: number) {
    return element(by.id(`pantry-item-${index}`));
  }

  private getItemDeleteButtonByIndex(index: number) {
    return element(by.id(`pantry-item-${index}-delete`));
  }

  private getItemExpirationByIndex(index: number) {
    return element(by.id(`pantry-item-${index}-expiration`));
  }

  /**
   * NOTE: index-keyed, which the app does not render — rows are
   * `pantry-item-<itemId>`. Kept only for `expectItemQuantity`'s existing
   * signature; prefer `expectQuantityRendered`, which matches by rendered text.
   */
  private getItemQuantityByIndex(index: number) {
    return element(by.id(`pantry-item-${index}-quantity`));
  }

  async navigateToTab() {
    // Generous timeouts: the tab bar settles slowly after a relaunch, and the
    // screen then has to load data.
    await waitFor(element(by.id('tab-pantry')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('tab-pantry')).tap();
    await this.waitForScreen(10000);
  }

  async tapAddButton() {

    await waitFor(element(by.id(this.addButton)))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.id(this.addButton)).tap();
  }

  /** `quantity` accepts a number, a fraction ("1 1/4"), or a decimal ("0.25"). */
  async addItem(
    name: string,
    quantity?: string | number,
    unit?: string,
    expirationDate?: string,
  ) {
    await this.openAddDetailsForm();

    // `replaceText`, not typing: typing raises the Android stylus popup.
    const nameInput = element(by.id('add-pantry-item-name-input'));
    await nameInput.replaceText(name);

    // Let the autocomplete sheet animation settle.
    await waitFor(element(by.id('add-pantry-item-name-input')))
      .toBeVisible()
      .withTimeout(1000);

    await element(by.id('add-pantry-item-name-input')).tapReturnKey();

    // The name field's dropdown overlays the page indicator and Cancel, so while
    // it is open Cancel reports "not hittable at its visible point" and a page tap
    // silently does nothing — after which a field on the target page reads MISSING.
    await this.dismissNameAutocomplete();

    if (quantity !== undefined || unit) {
      // The sheet is PAGED — Main / Details / Storage / Stock — inside a PagerView,
      // so a field on another page is UNMOUNTED, not merely off-screen. Detox
      // reports that as "No elements found", not a visibility timeout.
      await this.goToFormPage(PantryScreen.FORM_PAGE_DETAILS);

      // Wait for the page to mount: `PagerView` animates the change, and the
      // incoming page's fields do not exist until it settles.
      await waitFor(element(by.id('add-pantry-item-quantity-input')))
        .toBeVisible()
        .withTimeout(5000);
    }

    if (quantity !== undefined) {
      const quantityStr = typeof quantity === 'number' ? quantity.toString() : quantity;
      const quantityInput = element(by.id('add-pantry-item-quantity-input'));

      await quantityInput.replaceText(quantityStr);
    }

    if (unit) {
      // `replaceText` again, to avoid the Android stylus popup.
      const unitInput = element(by.id('add-pantry-item-unit-picker'));
      await unitInput.replaceText(unit);

      await element(by.id('add-pantry-item-unit-picker')).tapReturnKey();

      await new Promise(resolve => setTimeout(resolve, 500));

      // Tap the modal background to clear any dropdown still up.
      try {
        await element(by.id('add-pantry-item-details-modal')).tap({ x: 10, y: 10 });
      } catch {
        // Nothing to dismiss.
      }

      // Let the keyboard and autocomplete finish retracting.
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (expirationDate) {
      await this.tapByID('add-pantry-item-expiration-picker');
      // A real date-picker interaction would be platform-specific.
      await this.tapByText(expirationDate);
    }

    await this.tapByID('add-pantry-item-submit-button');

    // Check if error modal appeared (e.g., "Please enter a valid quantity")
    try {
      await waitFor(element(by.text('Please enter a valid quantity')))
        .toBeVisible()
        .withTimeout(2000);

      await element(by.text('OK')).tap();
      throw new Error(
        `Failed to add pantry item: Invalid quantity "${quantity}". ` +
        `Expected formats: "1", "1.5", "1/4", or "1 1/4"`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to add pantry item')) {
        throw error;
      }
      // Otherwise, error modal didn't appear (good!), continue
    }

    // Wait on the name input, which only the form renders; 15s covers the
    // mutation plus the Apollo cache update.
    await waitFor(element(by.id('add-pantry-item-name-input')))
      .not.toBeVisible()
      .withTimeout(15000);

    await waitFor(element(by.id('pantry-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Let the success toast finish. At `top: insets.top` it covers the header, not
    // the list, so row assertions pass with it up — but a header tap would go
    // through it, and its animation keeps Detox from reporting the app idle.
    // Best-effort: the toast auto-dismisses, so a miss means it already went.
    try {
      await waitFor(element(by.id('toast-success')))
        .not.toBeVisible()
        .withTimeout(6000);
    } catch {
      // Still up after 6s, or never rendered. Neither says the add failed.
    }
  }

  async editItemByIndex(
    index: number,
    updates: {
      name?: string;
      quantity?: number;
      expirationDate?: string;
    },
  ) {
    await this.getItemByIndex(index).tap();

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

    await waitFor(element(by.id('edit-pantry-item-modal')))
      .not.toBeVisible()
      .withTimeout(3000);
  }

  async swipeToDeleteItem(index: number) {
    await this.getItemByIndex(index).swipe('left', 'fast');
    await this.getItemDeleteButtonByIndex(index).tap();
  }

  async searchFor(query: string) {
    await this.clearAndType(this.searchInput, query);
    await this.dismissKeyboard();
  }

  async clearSearch() {
    await this.getElementById(this.searchInput).clearText();
  }

  async openSort() {
    await this.tapByID(this.sortButton);
  }

  async pullToRefresh() {
    await this.getElementById(this.listContainer).swipe('down', 'fast', 0.75);
    await this.waitForElementToDisappear(this.refreshControl, 5000);
  }

  async scrollToBottom() {
    await this.scrollTo(this.listContainer, 'bottom');
  }

  async scrollToTop() {
    await this.scrollTo(this.listContainer, 'top');
  }

  async expectEmptyState() {
    await this.expectVisible(this.emptyState);
  }

  async expectLoadingVisible() {
    await this.expectVisible(this.loadingIndicator);
  }

  async expectItemExists(index: number) {
    await expect(this.getItemByIndex(index)).toExist();
  }

  async expectItemVisible(index: number) {
    await expect(this.getItemByIndex(index)).toBeVisible();
  }

  async expectItemName(index: number, name: string) {
    await expect(this.getItemByIndex(index)).toHaveText(name);
  }

  async expectItemExpiration(index: number, date: string) {
    await expect(this.getItemExpirationByIndex(index)).toHaveText(date);
  }

  async expectItemQuantity(index: number, quantity: string) {
    await expect(this.getItemQuantityByIndex(index)).toHaveText(quantity);
  }

  /**
   * Assert the app RENDERED this quantity: a row-exists check alone passes just as
   * happily when "1 1/4" parses as `1`. Matched by TEXT — FlashList RECYCLES
   * views, so hierarchy order (what `atIndex` walks) is not visual order. It
   * proves the value is on screen, not whose row it is; see `expectItemInPantry`.
   */
  async expectQuantityRendered(expected: string) {
    await waitFor(element(by.text(expected)).atIndex(0))
      .toBeVisible()
      .withTimeout(5000);
  }

  async expectItemExpiringSoon(index: number) {
    await this.expectVisible(`pantry-item-${index}-expiring-warning`);
  }

  async expectItemLowStock(index: number) {
    await this.expectVisible(`pantry-item-${index}-low-stock-warning`);
  }

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

  async waitForListToLoad(timeout: number = 10000) {
    await this.waitForElementToDisappear(this.loadingIndicator, timeout);
  }

  async longPressItem(index: number, duration: number = 1000) {
    await this.getItemByIndex(index).longPress(duration);
  }

  async increaseQuantity(index: number) {
    await this.tapByID(`pantry-item-${index}-increase-quantity`);
  }

  async decreaseQuantity(index: number) {
    await this.tapByID(`pantry-item-${index}-decrease-quantity`);
  }
}
