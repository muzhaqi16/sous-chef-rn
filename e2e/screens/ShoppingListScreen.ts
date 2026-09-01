/** Screen object model for the Shopping List screen. */

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

  private getItemByIndex(index: number) {
    return element(by.id(`shopping-list-item-${index}`));
  }

  private getItemByName(name: string) {
    return element(by.id(`shopping-list-item-${name}`));
  }

  private getItemCheckboxByIndex(index: number) {
    return element(by.id(`shopping-list-item-${index}-checkbox`));
  }

  private getItemDeleteButtonByIndex(index: number) {
    return element(by.id(`shopping-list-item-${index}-delete`));
  }

  private getItemEditButtonByIndex(index: number) {
    return element(by.id(`shopping-list-item-${index}-edit`));
  }

  /** The tab testID is `tab-shoppinglist` — no dash, from route name `ShoppingList`. */
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

  async tapAddButton() {

    await this.tapByID(this.addButton);
  }

  /**
   * Blur by tapping the details sheet's top-left corner, which sits ABOVE the
   * keyboard and so stays hittable. These call sites do not all know which field
   * holds focus, so `BaseScreen.dismissKeyboard`'s targeted return key does not
   * apply. `replaceText` needs 100% visibility, which a keyboard overlap denies.
   */
  private async dismissSheetKeyboard() {
    try {
      await element(by.id('add-shopping-item-details')).tap({ x: 10, y: 10 });
    } catch {
      // Nothing focused, or the sheet moved — the next action reports it.
    }
  }

  /**
   * Type into one of the details sheet's `variant="modal"` autocompletes. Typing
   * presents a second `BottomSheetModal` (`stackBehavior="push"`) ON TOP of the
   * details sheet, so a timeout on `add-shopping-item-submit-button` is that sheet
   * in front of it, not a missing testID. Commit via `${testID}-search` + return.
   */
  private async fillModalAutocomplete(
    testID: string,
    value: string,
    { selectSuggestion = false }: { selectSuggestion?: boolean } = {},
  ) {
    // Bring the field into view: the keyboard pushes the unit picker below the
    // fold, which Detox reports as "View is not hittable at its visible point".
    try {
      await waitFor(element(by.id(testID)))
        .toBeVisible()
        .whileElement(by.id('add-shopping-item-scroll'))
        .scroll(200, 'down', NaN, 0.85);
    } catch {
      // Already on screen, or the sheet does not scroll — the type below is
      // what decides.
    }

    await element(by.id(testID)).replaceText(value);

    const search = element(by.id(`${testID}-search`));
    try {
      await waitFor(search).toBeVisible().withTimeout(5000);
    } catch {
      // No picker opened — the field already holds the value, so there is
      // nothing to commit and nothing covering the submit button.
      return;
    }

    await search.replaceText(value);

    // Tapping a suggestion and committing typed text are DIFFERENT actions. UNIT
    // is a closed catalog: only the tap calls `onUnitSelected`, resolving a real
    // entity. ITEM NAME is open, and tapping a fuzzy match would swap the test's
    // generated name for a catalog one. So selection is opt-in; return is default.
    if (selectSuggestion) {
      try {
        const suggestion = element(by.id(`${testID}-suggestion-0`));
        await waitFor(suggestion).toBeVisible().withTimeout(3000);
        await suggestion.tap();
      } catch {
        // No suggestion for this value — commit it as typed.
        await search.tapReturnKey();
      }
    } else {
      await search.tapReturnKey();
    }

    // The typed value is ALREADY committed — `handleBottomSheetTextChange` fires
    // `onChangeText` per keystroke and return only closes the picker — so the
    // fallback below costs nothing, and return does not always land on the unit.
    try {
      await waitFor(element(by.id('add-shopping-item-submit-button')))
        .toBeVisible()
        .withTimeout(5000);
      await this.dismissSheetKeyboard();
      return;
    } catch {
      // Press return again rather than swiping the sheet away. A swipe on a
      // stacked `BottomSheetModal` takes the whole stack with it — including the
      // details sheet that owns the submit button — so the fallback removed the
      // very element it was waiting for.
      try {
        await search.tapReturnKey();
      } catch {
        // Picker closed between the check and the retry.
      }
      // Deliberately NOT dismissing the keyboard here: that taps the details
      // sheet, which is still BEHIND the picker on this path, so the tap lands
      // on the picker and can undo the close it is meant to follow. The keyboard
      // is dismissed after the submit button is confirmed back.
    }

    // Wait for the SUBMIT BUTTON, not for the search field to go away: the
    // picker's dismissal and the host sheet's re-layout finish at different
    // times, so the two claims are not equivalent.
    await waitFor(element(by.id('add-shopping-item-submit-button')))
      .toBeVisible()
      .withTimeout(10000);

    // The picker is gone but its keyboard is not; the next field needs the room.
    await this.dismissSheetKeyboard();
  }

  /**
   * Close the picker sheet (`AddItemSheet`) by swipe: it renders no close button,
   * and `device.pressBack()` is Android-only and throws outright on iOS.
   */
  async dismissAddItemSheet() {
    // Unwind the DETAILS step first if it is up. `AddItemSheet` stacks it over
    // the picker, so swiping the picker down while the details form is in front
    // dismisses nothing and the list never comes back. Cancel is derived by
    // `SheetFormHeader` from the submit id (`-submit-button` -> `-cancel-button`).
    try {
      await element(by.id('add-shopping-item-cancel-button')).tap();
      await waitFor(element(by.id('add-shopping-item-name-input')))
        .not.toBeVisible()
        .withTimeout(5000);
    } catch {
      // Details step not open — the picker swipe below is all that is needed.
    }

    try {
      await element(by.id('add-shopping-item-modal'))
        .atIndex(0)
        .swipe('down', 'fast', 0.9);
    } catch {
      // Already closed.
    }
    // Confirm we are actually back on the list, and take one more pass if not.
    // The sheet stack is two deep (picker + details) and either layer can still
    // be unwinding; a single blind swipe leaves the list covered and the next
    // assertion blames the list.
    try {
      await waitFor(element(by.id(this.screenID)))
        .toBeVisible()
        .withTimeout(5000);
      return;
    } catch {
      // Fall through and unwind whatever is still up.
    }

    try {
      await element(by.id('add-shopping-item-cancel-button')).tap();
    } catch {
      // Details step already gone.
    }
    try {
      await element(by.id('add-shopping-item-modal'))
        .atIndex(0)
        .swipe('down', 'fast', 0.9);
    } catch {
      // Picker already gone.
    }

    await waitFor(element(by.id(this.screenID)))
      .toBeVisible()
      .withTimeout(10000);
  }

  /**
   * Swipe a row away by name. A left swipe reveals the RIGHT actions, which are
   * delete-only — edit sits on the left (`SortableItem` passes `leftActions` /
   * `rightActions`). Two attempts: a swipe that springs back leaves the tap on a
   * closed row, and `by.id(/…-delete$/).atIndex(0)` is not pinned to that row.
   */
  async deleteItemByName(name: string) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await waitFor(element(by.text(name)))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.text(name)).swipe('left', 'fast', 0.7);

      const deleteButton = element(
        by.id(/^shopping-list-item-.+-delete$/),
      ).atIndex(0);
      await waitFor(deleteButton).toBeVisible().withTimeout(5000);
      await deleteButton.tap();

      try {
        await waitFor(element(by.text(name)))
          .not.toBeVisible()
          .withTimeout(10000);
        return;
      } catch (error) {
        if (attempt === 1) {
          throw error;
        }
      }
    }
  }

  /**
   * Open the details form: tab-bar add button -> picker sheet -> "Add Manually".
   * Both taps are retried — a tap landing mid-animation is swallowed with no
   * error. Extracted so every caller gets the retries.
   */
  async openAddDetailsForm() {
    await this.tapAddButton();

    try {
      await waitFor(element(by.id('add-shopping-item-add-manually-button')))
        .toBeVisible()
        .withTimeout(3000);
    } catch {
      console.log('Picker sheet did not open, retrying add button tap...');
      await this.tapAddButton();
      await waitFor(element(by.id('add-shopping-item-add-manually-button')))
        .toBeVisible()
        .withTimeout(3000);
    }

    // Wait on the NAME INPUT, not on `add-shopping-item-modal`: that id belongs
    // to the PICKER sheet, which this tap navigates away from, so waiting for it
    // afterwards can only time out.
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
  }

  /** `quantity` accepts a number, a fraction ("1 1/4"), or a decimal ("0.25"). */
  async addItem(name: string, quantity?: string | number, unit?: string) {
    await this.openAddDetailsForm();

    // The name is a plain field — no picker. The unit below is a `variant="modal"`
    // autocomplete; see `fillModalAutocomplete`.
    await element(by.id('add-shopping-item-name-input')).replaceText(name);

    if (quantity !== undefined) {
      // `EditableCounter` is a plain input, but `replaceText` requires 100%
      // visibility (stricter than `toBeVisible`'s 75%) and a leftover keyboard
      // overlaps its bottom edge — reported as "not hittable at its visible
      // point". Two attempts, since blurring is itself best-effort.
      const quantityStr =
        typeof quantity === 'number' ? quantity.toString() : quantity;
      const quantityInput = element(by.id('add-shopping-item-quantity-input'));

      for (let attempt = 0; attempt < 2; attempt++) {
        await this.dismissSheetKeyboard();
        try {
          await waitFor(quantityInput)
            .toBeVisible()
            .whileElement(by.id('add-shopping-item-scroll'))
            .scroll(150, 'up', NaN, 0.15);
        } catch {
          // Already in view, or the sheet does not scroll.
        }

        try {
          await quantityInput.replaceText(quantityStr);
          break;
        } catch (error) {
          if (attempt === 1) {
            throw error;
          }
        }
      }
    }

    if (unit) {
      // Selected from the list, not typed: the unit has to resolve to a real
      // catalog entity for the save to mean anything.
      await this.fillModalAutocomplete('add-shopping-item-unit-picker', unit, {
        selectSuggestion: true,
      });
    }

    await this.tapByID('add-shopping-item-submit-button');

    // Check if error modal appeared (e.g., "Please enter a valid quantity")
    try {
      await waitFor(element(by.text('Please enter a valid quantity')))
        .toBeVisible()
        .withTimeout(2000);

      await element(by.text('OK')).tap();
      throw new Error(
        `Failed to add shopping list item: Invalid quantity "${quantity}". ` +
          `Expected formats: "1", "1.5", "1/4", or "1 1/4"`,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Failed to add shopping list item')
      ) {
        throw error;
      }
      // Otherwise, error modal didn't appear (good!), continue
    }

    // Wait for the form to close: 15s covers the mutation plus the cache update.
    // Waits on the NAME INPUT, which only the details step renders —
    // `add-shopping-item-modal` is the PICKER sheet's id, and `not.toBeVisible()`
    // on an id that is not on screen passes instantly, asserting nothing.
    await waitFor(element(by.id('add-shopping-item-name-input')))
      .not.toBeVisible()
      .withTimeout(15000);


    await waitFor(element(by.id('shopping-list-screen')))
      .toBeVisible()
      .withTimeout(5000);
  }

  async toggleItemByIndex(index: number) {
    await this.getItemCheckboxByIndex(index).tap();
  }

  async swipeToDeleteItem(index: number) {
    await this.getItemByIndex(index).swipe('left', 'fast');
    await this.getItemDeleteButtonByIndex(index).tap();
  }

  async editItemByIndex(index: number, newName: string) {
    await this.getItemByIndex(index).tap();

    await waitFor(element(by.id('edit-item-modal')))
      .toBeVisible()
      .withTimeout(3000);

    await this.clearAndType('edit-item-name-input', newName);

    // Check the name field, not `edit-item-modal`: it was just typed into, so it
    // is proven matchable, and a disappearance check against an unmatchable id
    // passes vacuously.
    await expectDisappearsAfter('edit-item-name-input', () =>
      this.tapByID('edit-item-submit-button'),
    );
  }

  async searchFor(query: string) {
    await this.clearAndType(this.searchInput, query);
    await this.dismissSheetKeyboard();
  }

  async clearSearch() {
    await this.getElementById(this.searchInput).clearText();
  }

  async openFilter() {
    await this.tapByID(this.filterButton);
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

  async expectItemText(index: number, text: string) {
    await expect(this.getItemByIndex(index)).toHaveText(text);
  }

  async expectItemChecked(index: number) {
    await expect(this.getItemCheckboxByIndex(index)).toHaveToggleValue(true);
  }

  async expectItemUnchecked(index: number) {
    await expect(this.getItemCheckboxByIndex(index)).toHaveToggleValue(false);
  }

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

  async waitForListToLoad(timeout: number = 10000) {
    await this.waitForElementToDisappear(this.loadingIndicator, timeout);
  }

  async longPressItem(index: number, duration: number = 1000) {
    await this.getItemByIndex(index).longPress(duration);
  }

  async dragItem(fromIndex: number, toIndex: number) {
    const fromElement = this.getItemByIndex(fromIndex);
    const toElement = this.getItemByIndex(toIndex);

    await fromElement.longPress();
    // Detox has no native drag-and-drop API; this may need a platform-specific path.
    await toElement.tap();
  }
}
