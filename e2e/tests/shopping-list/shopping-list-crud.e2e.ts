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

  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
  });

  beforeEach(async () => {
    await relaunchToHomeTab();
    await shoppingListScreen.navigateToTab();
    // navigateToTab already calls waitForScreen internally
  });

  describe('Add Item', () => {
    it('should add item with minimal info', async () => {
      const itemName = generateItemName('ShopItem');

      await shoppingListScreen.addItem(itemName);
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should add item with quantity and unit', async () => {
      const itemName = generateItemName('WithQty');

      await shoppingListScreen.addItem(itemName, '3', 'lb');
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should add item via quick add modal', async () => {
      // Tap the tab bar add button
      await tapByID('tab-bar-add-button');

      // Wait for "Add Manually" button to appear (indicates modal is open)
      await waitFor(element(by.id('add-shopping-add-manually-button')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Close modal
      await device.pressBack();
      await shoppingListScreen.waitForScreen();
    });

    it('should validate empty item name', async () => {
      await tapByID('tab-bar-add-button');

      // Wait for "Add Manually" button to appear (indicates modal is open)
      await waitFor(element(by.id('add-shopping-add-manually-button')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Tap add manually
      await element(by.id('add-shopping-add-manually-button')).tap();

      // Wait for the add item form modal
      await waitFor(element(by.id('add-item-modal')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Try to submit without name
      await tapByID('add-item-submit-button');

      // Whatever shape the complaint takes, the invariant is that the item was
      // NOT created: the form is still up. Without this, a submit that silently
      // saved an unnamed item passed the validation test.
      await waitFor(element(by.id('add-item-modal')))
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

      // Close modal
      await device.pressBack();
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

      // Tap item to edit
      const item = element(by.text(originalName));
      await item.tap();

      // Look for edit button
      const editButton = element(by.id('edit-item-button'));
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
      await shoppingListScreen.addItem(itemName, '1', 'lb');
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      const item = element(by.text(itemName));
      await item.tap();

      // Look for quantity controls
      const quantityButton = element(by.id('quantity-button'));
      await waitFor(quantityButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await quantityButton.tap();

      // Increment quantity
      const incrementButton = element(by.id('quantity-increment'));
      await waitFor(incrementButton)
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      await incrementButton.tap();

      await tapByID('quantity-confirm');

      await shoppingListScreen.goBack();
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

      const deleteButton = element(by.id('swipe-delete-button'));
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
      await shoppingListScreen.addItem(longName);
      await waitFor(element(by.text(longName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should handle fractional quantities', async () => {
      const itemName = generateItemName('Fractional');
      await shoppingListScreen.addItem(itemName, '1/4', 'cup');
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should handle special characters in item name', async () => {
      const specialName = "Trader Joe's O's Cereal";
      await shoppingListScreen.addItem(specialName);
      await waitFor(element(by.text(specialName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });
  });
});
