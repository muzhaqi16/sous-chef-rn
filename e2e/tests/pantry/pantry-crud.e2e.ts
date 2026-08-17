/**
 * Pantry CRUD E2E Tests
 *
 * Tests for pantry item management including:
 * - Adding items (minimal and full details)
 * - Editing items
 * - Deleting items
 * - Quantity adjustments
 */

import { element, by, waitFor, expect } from 'detox';
import { PantryScreen } from '../../screens';
import {
  bootstrapAuthenticatedSession,
  relaunchToHomeTab,
} from '../../helpers';
import { generateItemName } from '../../helpers/data';
import { TIMEOUTS } from '../../helpers/waitFor';

describe('Pantry CRUD', () => {
  const pantryScreen = new PantryScreen();
  let itemsToCleanup: string[] = [];

  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
  });

  beforeEach(async () => {
    await relaunchToHomeTab();
    await pantryScreen.waitForScreen();
    itemsToCleanup = [];
  });

  afterEach(async () => {
    // Clean up items created during the test
    for (const itemName of itemsToCleanup) {
      try {
        const item = element(by.text(itemName));
        // Swipe left to reveal delete button
        await item.swipe('left', 'fast', 0.7);
        // Tap delete button (trash icon). RightActions composes
        // `${testIDPrefix}-delete`; a pantry row's prefix is
        // `pantry-item-<entity id>`, unknown here, and only the swiped row has
        // its actions mounted.
        const deleteButton = element(by.id(/^pantry-item-.+-delete$/)).atIndex(
          0,
        );
        await waitFor(deleteButton).toBeVisible().withTimeout(TIMEOUTS.QUICK);
        await deleteButton.tap();
        // Wait for item to be removed
        await waitFor(element(by.text(itemName)))
          .not.toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);
      } catch {
        // Best-effort teardown only. A cleanup miss must not fail the test that
        // just passed — the assertions live in the `it` blocks.
      }
    }
  });

  describe('Add Item', () => {
    it('should add item with minimal info (name only)', async () => {
      const itemName = generateItemName('Minimal');
      itemsToCleanup.push(itemName);

      await pantryScreen.addItem(itemName);
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should add item with quantity and unit', async () => {
      const itemName = generateItemName('WithQty');
      itemsToCleanup.push(itemName);

      await pantryScreen.addItem(itemName, '2', 'lb');
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should add item via quick add (autocomplete)', async () => {
      // Quick add test: verify the add modal opens with action buttons
      await pantryScreen.tapAddButton();

      // Wait for the "Add Manually" button (proves modal is open)
      await waitFor(element(by.id('add-pantry-add-manually-button')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      console.log('✓ Add modal opened with action buttons');

      // Close the modal by pressing back
      await pantryScreen.goBack();
      await pantryScreen.waitForScreen();
    });

    it('should validate empty item name', async () => {
      await pantryScreen.tapAddButton();

      // Wait for the "Add Manually" button (proves modal is open)
      await waitFor(element(by.id('add-pantry-add-manually-button')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Tap add manually to go to details sheet
      const addManuallyButton = element(
        by.id('add-pantry-add-manually-button'),
      );
      await addManuallyButton.tap();

      await waitFor(element(by.id('add-pantry-item-details-modal')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Try to submit without entering name (default quantity is 1, so only name is missing)
      const submitButton = element(by.id('add-pantry-item-submit-button'));
      await submitButton.tap();

      // Whatever shape the complaint takes, the invariant is that the item was
      // NOT created: the details modal is still up. Logging "validation
      // handled" in the catch made every outcome — including a silent save —
      // report success.
      await waitFor(element(by.id('add-pantry-item-details-modal')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Dismiss the error alert if this build surfaces one.
      try {
        await waitFor(element(by.text('Error')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.QUICK);
        await element(by.text('OK')).tap();
      } catch {
        // Some builds block submission without an alert; the modal check above
        // is the assertion either way.
      }

      // Close the modal
      await pantryScreen.goBack();
    });
  });

  // The 'Edit Item' describe block was removed here. Its two tests
  // ('should edit item name', 'should edit item quantity') drove
  // `edit-item-button`, `edit-pantry-item-name-input`, `save-item-button` and
  // `quantity-increment` — none of which exist in `src/`. Both wrapped their
  // entire flow, assertion included, in a try/catch that logged and navigated
  // back, so they passed while exercising nothing. Repointing them means
  // deciding what the pantry edit flow should assert, which is new coverage,
  // not repair. Re-add them against real testIDs when that is written.

  describe('Delete Item', () => {
    it('should delete item via swipe', async () => {
      const itemName = generateItemName('ToDelete');
      // Don't add to cleanup - we're deleting it in this test
      await pantryScreen.addItem(itemName);
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Swipe left to reveal delete button
      const item = element(by.text(itemName));
      await item.swipe('left', 'fast', 0.7);

      // Tap the delete action button. `swipe-action-delete` does not exist —
      // RightActions composes `${testIDPrefix}-delete`, and a pantry row's
      // prefix is `pantry-item-<entity id>`, which this spec cannot know. Only
      // the swiped row has its actions mounted, so the suffix match is
      // unambiguous. Failing to find it is a failure, not a log line.
      const deleteButton = element(by.id(/^pantry-item-.+-delete$/)).atIndex(0);
      await waitFor(deleteButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await deleteButton.tap();

      // Verify item is gone. Catching this and pushing to cleanup meant a
      // delete that silently did nothing still passed the delete test.
      await waitFor(element(by.text(itemName)))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should cancel delete', async () => {
      const itemName = generateItemName('CancelDel');
      itemsToCleanup.push(itemName);
      await pantryScreen.addItem(itemName);
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Swipe left to reveal delete actions (but don't tap delete)
      const item = element(by.text(itemName));
      await item.swipe('left', 'fast', 0.3);

      // Item should still exist - swipe reveal doesn't delete
      await expect(element(by.text(itemName))).toExist();
      console.log('✓ Item still exists after swipe reveal');
    });
  });

  describe('Edge Cases', () => {
    it('should handle long item names', async () => {
      const longName = 'LongItemNameTest';
      itemsToCleanup.push(longName);
      await pantryScreen.addItem(longName);
      await waitFor(element(by.text(longName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      console.log('✓ Long item name handled');
    });

    it('should handle fractional quantities', async () => {
      const itemName = generateItemName('Frac');
      itemsToCleanup.push(itemName);
      await pantryScreen.addItem(itemName, '1/2', 'cup');
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should handle decimal quantities', async () => {
      const itemName = generateItemName('Decimal');
      itemsToCleanup.push(itemName);
      await pantryScreen.addItem(itemName, '2.5', 'kg');
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });
  });
});
