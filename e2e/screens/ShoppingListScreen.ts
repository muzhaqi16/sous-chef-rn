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

    await this.tapByID(this.addButton);
  }

  /**
   * Type a value into one of the details sheet's `variant="modal"` autocompletes.
   *
   * These do NOT behave like text inputs. `ShoppingListDetailsStep` renders the
   * unit (and brand / category / store) fields as `variant="modal"`, and
   * `BottomSheetAutocompleteInput` responds to typing by presenting its own
   * `BottomSheetModal` with `stackBehavior="push"` — a second sheet ON TOP of
   * the details sheet. (The item name used to be one too; it is a plain field
   * now, typed directly in `addItem`.)
   *
   * That is what made every add test fail. Typing into the picker field opened
   * the picker, the picker covered the header, and the run then timed out on
   * `add-shopping-item-submit-button` — with Detox's own artifact log showing
   * the button present, at a valid frame, `visible: false` / `hittable: false`.
   * It reads like a missing testID and is actually a sheet in front of it.
   *
   * Committing a typed value means going through the picker's own search field
   * (`${testID}-search`) and pressing return: `handleSubmitCustomValue` writes
   * the term back and sets `showAutocomplete(false)`, which is what closes the
   * picker. Tapping the details sheet to "dismiss the keyboard" cannot work —
   * the details sheet is behind the picker.
   */
  /**
   * Blur whatever holds the keyboard, by tapping the DETAILS SHEET's top-left
   * corner.
   *
   * Distinct from `BaseScreen.dismissKeyboard`, which taps the screen container
   * — that sits BEHIND the sheet during this flow, so the tap never reaches the
   * focused field.
   *
   * `replaceText` requires ONE HUNDRED PERCENT visibility — stricter than
   * `toBeVisible`'s 75% — so a keyboard overlapping even the bottom edge of the
   * quantity input fails the type with "View is not hittable at its visible
   * point", quoting bounds that look entirely fine. The picker's search field
   * is `autoFocus`, so the keyboard is up as soon as a name is committed and is
   * still up when the next field is typed.
   */
  private async dismissSheetKeyboard() {
    try {
      await element(by.id('add-shopping-item-details')).tap({ x: 10, y: 10 });
    } catch {
      // Nothing focused, or the sheet moved — the next action reports it.
    }
  }

  private async fillModalAutocomplete(
    testID: string,
    value: string,
    { selectSuggestion = false }: { selectSuggestion?: boolean } = {},
  ) {
    // Bring the field into view first. The unit picker is in the second
    // `FieldRow`, which the keyboard pushes below the fold after the name is
    // entered — Detox then fails the type with "View is not hittable at its
    // visible point", which names the symptom and not the scroll position.
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

    // Selecting a suggestion and committing the typed text are DIFFERENT
    // actions, and which one is correct depends on the field:
    //
    //   - UNIT is a closed catalog. Tapping the row calls
    //     `onUnitSelected(item.id, name, type, symbol)`, so the item is saved
    //     against a real unit. The return key only calls `onChangeText`, which
    //     saves the string and never exercises resolution — not what a user
    //     picking "lb — pound" out of the list does.
    //   - ITEM NAME is open. The tests use generated names, and a fuzzy match
    //     against the catalog is NOT the value under test — tapping it replaces
    //     the unique name with an existing item's, and the row the test then
    //     looks for never appears. (Six tests failed exactly this way when
    //     selection was applied to both fields.)
    //
    // So selection is opt-in, and the return key remains the default.
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

    // The typed value is ALREADY committed at this point:
    // `handleBottomSheetTextChange` calls `onChangeText` on every keystroke. The
    // return key only closes the picker (`handleSubmitCustomValue` sets
    // `showAutocomplete(false)`). So if the picker is still up, swiping it away
    // loses nothing — which makes a fallback safe, and worth having, because the
    // return key intermittently does not land on the unit field.
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

    // Wait for the SUBMIT BUTTON to come back, not for the search field to go
    // away. Those are not the same claim: the picker's dismissal animation and
    // the host sheet's re-layout finish at different times, so a `not.toBeVisible`
    // on the search field can still be false while the thing the caller actually
    // needs — a hittable header — is already there, and vice versa. Asserting
    // the precondition directly is both stabler and honest about the intent.
    await waitFor(element(by.id('add-shopping-item-submit-button')))
      .toBeVisible()
      .withTimeout(10000);

    // The picker is gone but its keyboard is not; the next field needs the room.
    await this.dismissSheetKeyboard();
  }

  /**
   * Close the picker sheet (`AddItemSheet`).
   *
   * By swipe: the sheet renders no close button, and `device.pressBack()` — what
   * the specs used — is Android-only and throws outright on iOS.
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
   * Swipe a row away by name.
   *
   * Left swipe: in `swipeMode === 'shopping'` the RIGHT actions are delete-only
   * (edit lives on the left). Two attempts, because a swipe that springs back
   * instead of latching leaves the tap landing on a closed row, and
   * `by.id(/…-delete$/).atIndex(0)` is not pinned to the row just swiped — with
   * 50+ rows, which one is index 0 depends on what is currently mounted.
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
   *
   * Both taps are retried. Landing either one mid-animation gets it swallowed
   * with no error, which is what made this flow pass on one run and fail on the
   * next. Extracted so every caller gets the retries — `should validate empty
   * item name` drove the two taps by hand and failed on the details step for
   * exactly that reason, while `addItem` (same taps, with retries) passed.
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

  /**
   * Add new item to shopping list
   * @param quantity - Can be number, fraction (e.g., "1 1/4"), or decimal (e.g., "0.25")
   */
  async addItem(name: string, quantity?: string | number, unit?: string) {
    await this.openAddDetailsForm();

    // The name is a plain field — no picker opens for it. The unit below IS
    // a `variant="modal"` autocomplete, so typing into it opens a SECOND
    // BottomSheetModal stacked over this sheet — see `fillModalAutocomplete`
    // for why that matters and how it is closed.
    await element(by.id('add-shopping-item-name-input')).replaceText(name);

    if (quantity !== undefined) {
      // `EditableCounter` is a plain input — no picker. But `replaceText`
      // requires ONE HUNDRED PERCENT visibility (stricter than `toBeVisible`'s
      // 75%), and the keyboard left over from the name picker overlaps this
      // field's bottom edge often enough to matter. The failure reads "View is
      // not hittable at its visible point" and quotes bounds that look fine.
      //
      // Two attempts, each blurring and scrolling first, because the keyboard
      // dismissal is itself best-effort — a tap that lands while the picker is
      // still unwinding does nothing, and the retry is cheaper than a flake.
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

    // Wait for the form to close (15s max, to cover the GraphQL mutation plus
    // the Apollo cache update).
    //
    // Waits on the NAME INPUT, which only the details step renders. The previous
    // wait was on `add-shopping-item-modal` — an id `AddItemSheet` composes as
    // `${config.testIDPrefix}-modal` for the PICKER sheet, not for this form. A
    // `not.toBeVisible()` on an id that is not on screen passes the instant it
    // is evaluated, so this step asserted nothing at all and the run continued
    // whether or not the item had been submitted.
    await waitFor(element(by.id('add-shopping-item-name-input')))
      .not.toBeVisible()
      .withTimeout(15000);


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
    await this.dismissSheetKeyboard();
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
