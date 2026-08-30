/**
 * Shopping list CRUD: adding, editing, and deleting items.
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
    // A longer list is not neutral — it pushes a freshly added row out of view
    // and brings back the scroll/visibility failures. So clean up every run.
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

      // The "Add Manually" button appearing is how the modal announces itself.
      await waitFor(element(by.id('add-shopping-item-add-manually-button')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await shoppingListScreen.dismissAddItemSheet();
      await shoppingListScreen.waitForScreen();
    });

    it('should validate empty item name', async () => {
      // Same retry-backed path `addItem` uses — a tap landing mid-animation is
      // swallowed silently, so never drive the two taps by hand.
      await shoppingListScreen.openAddDetailsForm();

      // TWO add/edit surfaces here, not interchangeable: "Add Manually" opens
      // the BOTTOM SHEET (`ShoppingListDetailsStep`, ids prefixed
      // `add-shopping-item-`), while `add-item-modal` belongs to the
      // `AddEditItem` SCREEN this flow never reaches. Asserted on the NAME INPUT
      // — the `add-shopping-item-details` container does not reliably clear
      // Detox's visibility threshold while the picker sheet is still unwinding.
      await waitFor(element(by.id('add-shopping-item-name-input')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await tapByID('add-shopping-item-submit-button');

      // Whatever shape the complaint takes, the invariant is that the item was
      // NOT created: the form is still up.
      await waitFor(element(by.id('add-shopping-item-name-input')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // REQUIRE the validation alert — an empty-name submit is specified to
      // complain, so its absence is a failure. It is an IN-APP modal
      // (`alertService` replaces `Alert.alert`, falling back to the native one
      // only if its provider is unmounted), so Detox's system matchers do not
      // reach it: `system.element(by.system.label('OK'))` finds nothing and
      // blocks. Matched by testID, since the button's text is translated.
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

      // Swipe RIGHT. `SortableItem` splits the two actions across the sides —
      // `leftActions` is edit, `rightActions` is delete — and RNGH reveals the
      // LEFT tray on a right swipe. So a LEFT swipe (the delete test's gesture)
      // can never surface edit, however long it waits. Tapping the row is not
      // the answer either; that opens the item detail screen.
      await element(by.text(originalName)).swipe('right', 'fast', 0.7);

      // The prefix is `shopping-list-item-<id>` and the action appends `-edit`,
      // so the item's id sits in the MIDDLE — the bare `shopping-list-item-edit`
      // is never rendered. Hence the regex.
      const editButton = element(by.id(/^shopping-list-item-.+-edit$/)).atIndex(
        0,
      );
      await waitFor(editButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await editButton.tap();

      await waitFor(element(by.id('edit-item-modal')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      const nameInput = element(by.id('edit-item-name-input'));
      await nameInput.clearText();
      await nameInput.typeText(originalName + ' Edited');

      // Save. The editor is gone when its name field is gone — that field was
      // just typed into, so it is proven matchable, and the check cannot pass
      // because the matcher found nothing.
      await expectDisappearsAfter('edit-item-name-input', () =>
        tapByID('edit-item-submit-button'),
      );

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
      // `QuantityBadge`'s testID is keyed by item id, hence the regex.
      await element(by.id(/^shopping-list-item-.+-quantity$/))
        .atIndex(0)
        .tap();

      await waitFor(element(by.id('quantity-edit-increment')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Save is `disabled: !hasChanges`, and tapping a disabled Pressable is a
      // silent no-op, so a missed increment surfaces 15s later as "the sheet did
      // not close" — pointing at the save, not at the tap that never landed.
      // Hence increment-and-re-save rather than trusting the first tap. The wait
      // is long because the sheet closes on the mutation's response: it covers
      // the round trip plus the Apollo cache write, not just an animation.
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

      const item = element(by.text(itemName));
      await item.swipe('left', 'fast', 0.7);

      // `SwipeableItem` appends `-delete` to `SortableItem`'s
      // `testIDPrefix` of `shopping-list-item-<id>`, so the item id sits in the
      // middle — same shape as the edit button above.
      const deleteButton = element(
        by.id(/^shopping-list-item-.+-delete$/),
      ).atIndex(0);
      await waitFor(deleteButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await deleteButton.tap();

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
      // NOT asserting the rendered quantity, unlike the pantry equivalent: this
      // list has no deterministic newest-first order, so "the row at index 0" is
      // not this test's row; `QuantityBadge` renders value and unit as two
      // `<Text>` nodes, so `toHaveText` has no single string to match; and it
      // prefers `quantityInput` over the formatted number, showing "1/4", not
      // "0.25". The parse itself is covered by the pantry equivalent.
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
