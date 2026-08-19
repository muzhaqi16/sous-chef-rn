/**
 * Shopping List CRUD E2E Tests
 *
 * Tests for shopping list item management including:
 * - Adding items
 * - Editing items
 * - Deleting items
 */

import { element, by, waitFor, expect } from 'detox';
import { ShoppingListScreen } from '../../screens';
import {
  bootstrapAuthenticatedSession,
  relaunchToHomeTab,
} from '../../helpers';
import { generateItemName } from '../../helpers/data';
import { TIMEOUTS } from '../../helpers/waitFor';
import { tapByID } from '../../helpers/actions';
import { expectDisappearsAfter } from '../../helpers/assertions';

describe('Shopping List CRUD', () => {
  const shoppingListScreen = new ShoppingListScreen();
  let itemsToCleanup: string[] = [];

  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
  });

  beforeEach(async () => {
    await relaunchToHomeTab();
    await shoppingListScreen.navigateToTab();
    // navigateToTab already calls waitForScreen internally
    itemsToCleanup = [];
  });

  afterEach(async () => {
    // The pantry spec has always done this; this one never did, so every run
    // left its rows behind. The list grew across runs during the repair session
    // and a longer list is not neutral — it is what pushes a freshly added row
    // out of view and brings back the scroll/visibility failures.
    for (const itemName of itemsToCleanup) {
      try {
        await shoppingListScreen.deleteItemByName(itemName);
      } catch {
        // Best-effort teardown. A cleanup miss must not fail a test that just
        // passed — the assertions live in the `it` blocks.
      }
    }
  });

  describe('Add Item', () => {
    it('should add item with minimal info', async () => {
      const itemName = generateItemName('ShopItem');
      itemsToCleanup.push(itemName);

      await shoppingListScreen.addItem(itemName);
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should add item with quantity and unit', async () => {
      const itemName = generateItemName('WithQty');
      itemsToCleanup.push(itemName);

      await shoppingListScreen.addItem(itemName, '3', 'lb');
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should add item via quick add modal', async () => {
      // Through the screen object, which dismisses the feature-hint overlay
      // first and retries the tap. A bare `tapByID('tab-bar-add-button')` lands
      // on the overlay whenever it is up and the sheet never opens.
      await shoppingListScreen.tapAddButton();

      // Wait for "Add Manually" button to appear (indicates modal is open)
      await waitFor(element(by.id('add-shopping-item-add-manually-button')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await shoppingListScreen.dismissAddItemSheet();
      await shoppingListScreen.waitForScreen();
    });

    it('should validate empty item name', async () => {
      // Same retry-backed path `addItem` uses. Driving the two taps by hand here
      // is what made this test fail while every other add test passed: a tap
      // that lands mid-animation is swallowed silently.
      await shoppingListScreen.openAddDetailsForm();

      // The details step is up. There are TWO add/edit surfaces in this
      // feature and they are not interchangeable: "Add Manually" opens the
      // BOTTOM SHEET (`ShoppingListDetailsStep`, ids prefixed
      // `add-shopping-item-`), while `add-item-modal` belongs to the
      // `AddEditItem` SCREEN, which this flow never reaches. Waiting for the
      // screen's id here could only ever time out.
      // Asserted on the NAME INPUT rather than the `add-shopping-item-details`
      // container: the container is the step's outermost view and does not
      // reliably clear Detox's visibility threshold while the picker sheet is
      // still unwinding, whereas the name input is the element the opener
      // already proved matchable.
      await waitFor(element(by.id('add-shopping-item-name-input')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Try to submit without name
      await tapByID('add-shopping-item-submit-button');

      // Whatever shape the complaint takes, the invariant is that the item was
      // NOT created: the form is still up. Without this, a submit that silently
      // saved an unnamed item passed the validation test.
      await waitFor(element(by.id('add-shopping-item-name-input')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Dismiss the validation alert, and REQUIRE it — an empty-name submit is
      // specified to complain, so its absence is a failure, not a build
      // difference.
      //
      // It is an IN-APP modal, not a native one: `alertService` is "a custom
      // modal alert replacement for React Native's Alert.alert" and only falls
      // back to the native one if its provider is unmounted. So Detox's system
      // matchers do not apply here — `system.element(by.system.label('OK'))`
      // finds nothing and blocks. Matched by testID rather than by the button's
      // text, which is translated.
      await waitFor(element(by.id('alert-modal')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await element(by.id('alert-button-0')).tap();
      await waitFor(element(by.id('alert-modal')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await shoppingListScreen.dismissAddItemSheet();
      await shoppingListScreen.waitForScreen();
    });
  });

  describe('Edit Item', () => {
    it('should edit item name', async () => {
      const originalName = generateItemName('ToEdit');
      await shoppingListScreen.addItem(originalName);
      await waitFor(element(by.text(originalName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Swipe RIGHT. In `swipeMode === 'shopping'` the two actions are split
      // across the two sides: `RightActions` returns delete only ("edit is on
      // left swipe", per its own comment), and `LeftActions` renders edit. So a
      // LEFT swipe — the gesture the delete test uses — reveals delete and can
      // never surface edit, however long it waits. Tapping the row is not the
      // answer either; that opens the item detail screen.
      await element(by.text(originalName)).swipe('right', 'fast', 0.7);

      // Look for edit button
      // `${testIDPrefix}-edit`, where the prefix is `shopping-list-item-<id>` —
      // so the id it renders has the item's id in the MIDDLE. The bare
      // `shopping-list-item-edit` this used to look for is never rendered.
      const editButton = element(by.id(/^shopping-list-item-.+-edit$/)).atIndex(
        0,
      );
      await waitFor(editButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await editButton.tap();

      // Wait for edit modal
      await waitFor(element(by.id('edit-item-modal')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Change name
      const nameInput = element(by.id('edit-item-name-input'));
      await nameInput.clearText();
      await nameInput.typeText(originalName + ' Edited');

      // Save. The editor is gone when its name field is gone — that field was
      // just typed into, so it is proven matchable, and the check cannot pass
      // because the matcher found nothing.
      await expectDisappearsAfter('edit-item-name-input', () =>
        tapByID('edit-item-submit-button'),
      );

      // Verify change
      await waitFor(element(by.text(originalName + ' Edited')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should edit item quantity', async () => {
      const itemName = generateItemName('QtyEdit');
      itemsToCleanup.push(itemName);
      await shoppingListScreen.addItem(itemName, '1', 'lb');
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // The quantity badge on the row opens the edit sheet — there is no
      // `quantity-button`, and tapping the row itself opens the detail screen.
      // `QuantityBadge` had no testID at all until it was given one keyed by
      // item id, so this flow was previously unreachable.
      await element(by.id(/^shopping-list-item-.+-quantity$/))
        .atIndex(0)
        .tap();

      await waitFor(element(by.id('quantity-edit-increment')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Save is `disabled: !hasChanges`, and tapping a disabled Pressable is a
      // silent no-op — not an error. So an increment that does not register
      // leaves the sheet open and the failure surfaces 15s later as "the sheet
      // did not close", pointing at the save rather than at the tap that never
      // landed. Increment again and re-save rather than assuming the first tap
      // took.
      //
      // The wait is long because saving fires a mutation and the sheet closes on
      // the response — this covers the round trip plus the Apollo cache write,
      // not just an animation.
      for (let attempt = 0; attempt < 2; attempt++) {
        await element(by.id('quantity-edit-increment')).tap();
        await element(by.id('quantity-edit-save')).tap();

        try {
          await waitFor(element(by.id('quantity-edit-increment')))
            .not.toBeVisible()
            .withTimeout(15000);
          break;
        } catch (error) {
          if (attempt === 1) {
            throw error;
          }
        }
      }
      await shoppingListScreen.waitForScreen();
    });
  });

  describe('Delete Item', () => {
    it('should delete item via swipe', async () => {
      const itemName = generateItemName('ToDelete');
      await shoppingListScreen.addItem(itemName);
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Swipe to delete
      const item = element(by.text(itemName));
      await item.swipe('left', 'fast', 0.7);

      // `RightActions` builds `${testIDPrefix}-delete`, and
      // `ShoppingListMainContent` passes `testIDPrefix="shopping-list-item"`.
      // `swipe-delete-button` never existed.
      // Same shape as the edit button above: the item id sits in the middle.
      const deleteButton = element(
        by.id(/^shopping-list-item-.+-delete$/),
      ).atIndex(0);
      await waitFor(deleteButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await deleteButton.tap();

      // Verify item is gone
      await waitFor(element(by.text(itemName)))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });
  });

  describe('Edge Cases', () => {
    it('should handle long item names', async () => {
      const longName =
        'Very long shopping list item name that should be handled properly';
      itemsToCleanup.push(longName);
      await shoppingListScreen.addItem(longName);
      await waitFor(element(by.text(longName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should handle fractional quantities', async () => {
      const itemName = generateItemName('Fractional');
      itemsToCleanup.push(itemName);
      await shoppingListScreen.addItem(itemName, '1/4', 'cup');
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      // NOT asserting the rendered quantity here, unlike the pantry equivalent,
      // and the reason is worth recording rather than quietly skipping:
      //
      //   1. There is no deterministic newest-first order on this list (the
      //      pantry seeds one at launch), so "the row at index 0" is not the row
      //      this test just created.
      //   2. `QuantityBadge` renders the value and the unit as two separate
      //      `<Text>` nodes under the testID'd Pressable, so `toHaveText` has no
      //      single string to match.
      //   3. The badge prefers `quantityInput` over the formatted number
      //      (`quantityInput || formatQuantity(quantity)`), so it shows what the
      //      user typed — "1/4", not "0.25". Any assertion here has to expect the
      //      INPUT form, which is a weaker check of the parse than the pantry's.
      //
      // Until the row can be addressed by its own id, this test asserts only
      // that the item was created. The parse itself IS covered end-to-end by the
      // pantry equivalent, which renders through `CardRightSlot` (one Text) with
      // newest-first seeded.
    });

    it('should handle special characters in item name', async () => {
      const specialName = "Trader Joe's O's Cereal";
      itemsToCleanup.push(specialName);
      await shoppingListScreen.addItem(specialName);
      await waitFor(element(by.text(specialName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });
  });
});
