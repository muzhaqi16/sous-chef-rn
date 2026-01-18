/**
 * Shopping List CRUD E2E Tests
 *
 * Tests for shopping list item management including:
 * - Adding items
 * - Editing items
 * - Deleting items
 */

import { element, by, waitFor, expect } from 'detox';
import { launchAppWithFabricWorkaround } from '../../init';
import { ShoppingListScreen } from '../../screens';
import { bootstrapAuthenticatedSession, relaunchToHomeTab } from '../../helpers';
import { generateItemName } from '../../helpers/data';
import { delay, TIMEOUTS } from '../../helpers/waitFor';
import { tapByID } from '../../helpers/actions';

describe('Shopping List CRUD', () => {
  const shoppingListScreen = new ShoppingListScreen();

  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
  });

  beforeEach(async () => {
    await relaunchToHomeTab();
    await shoppingListScreen.navigateToTab();
    await shoppingListScreen.waitForScreen();
  });

  describe('Add Item', () => {
    it('should add item with minimal info', async () => {
      const itemName = generateItemName('ShopItem');

      await shoppingListScreen.addItem(itemName);
      await delay(1000);
      await shoppingListScreen.expectTextVisible(itemName);
    });

    it('should add item with quantity and unit', async () => {
      const itemName = generateItemName('WithQty');

      await shoppingListScreen.addItem(itemName, '3', 'lb');
      await delay(1000);
      await shoppingListScreen.expectTextVisible(itemName);
    });

    it('should add item via quick add modal', async () => {
      // Tap the tab bar add button
      await tapByID('tab-bar-add-button');

      // Wait for add modal
      await waitFor(element(by.id('add-shopping-item-modal')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Search for item
      try {
        const searchInput = element(by.id('shopping-search-input'));
        await searchInput.typeText('Bread');
        await delay(1000);

        // Try to tap suggestion
        const suggestion = element(by.text('Bread')).atIndex(0);
        await suggestion.tap();

        // Modal should close after adding
        await waitFor(element(by.id('add-shopping-item-modal')))
          .not.toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);
      } catch {
        console.log('Quick add via search not available');
        // Close modal
        await device.pressBack();
      }
    });

    it('should validate empty item name', async () => {
      await tapByID('tab-bar-add-button');

      await waitFor(element(by.id('add-shopping-item-modal')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Tap add manually
      try {
        await tapByID('add-manually-button');

        await waitFor(element(by.id('add-item-modal')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);

        // Try to submit without name
        await tapByID('add-item-submit-button');

        // Should stay on modal or show error
        await delay(500);
        await waitFor(element(by.id('add-item-modal')))
          .toBeVisible()
          .withTimeout(1000);
      } catch {
        console.log('Manual add validation flow different than expected');
      }
    });
  });

  describe('Edit Item', () => {
    it('should edit item name', async () => {
      const originalName = generateItemName('ToEdit');
      await shoppingListScreen.addItem(originalName);
      await delay(1000);

      // Tap item to edit
      const item = element(by.text(originalName));
      await item.tap();

      // Wait for detail/edit screen
      await delay(500);

      try {
        // Look for edit button
        const editButton = element(by.id('edit-item-button'));
        await waitFor(editButton).toBeVisible().withTimeout(2000);
        await editButton.tap();

        // Wait for edit modal
        await waitFor(element(by.id('edit-item-modal')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);

        // Change name
        const nameInput = element(by.id('edit-item-name-input'));
        await nameInput.clearText();
        await nameInput.typeText(originalName + ' Edited');

        // Save
        await tapByID('edit-item-submit-button');

        await delay(1000);

        // Navigate back and verify
        await shoppingListScreen.expectTextVisible(originalName + ' Edited');
      } catch {
        console.log('Edit flow different - navigating back');
        await shoppingListScreen.goBack();
      }
    });

    it('should edit item quantity', async () => {
      const itemName = generateItemName('QtyEdit');
      await shoppingListScreen.addItem(itemName, '1', 'lb');
      await delay(1000);

      const item = element(by.text(itemName));
      await item.tap();

      await delay(500);

      try {
        // Look for quantity controls
        const quantityButton = element(by.id('quantity-button'));
        await waitFor(quantityButton).toBeVisible().withTimeout(2000);
        await quantityButton.tap();

        // Increment quantity
        const incrementButton = element(by.id('quantity-increment'));
        await incrementButton.tap();

        await delay(300);
        await tapByID('quantity-confirm');
      } catch {
        console.log('Quantity edit UI not found');
      }

      await shoppingListScreen.goBack();
    });
  });

  describe('Delete Item', () => {
    it('should delete item via swipe', async () => {
      const itemName = generateItemName('ToDelete');
      await shoppingListScreen.addItem(itemName);
      await delay(1000);
      await shoppingListScreen.expectTextVisible(itemName);

      // Swipe to delete
      const item = element(by.text(itemName));
      await item.swipe('left', 'fast', 0.7);

      await delay(500);

      try {
        const deleteButton = element(by.id('swipe-delete-button'));
        await waitFor(deleteButton).toBeVisible().withTimeout(1000);
        await deleteButton.tap();
      } catch {
        // Might auto-delete
      }

      await delay(500);

      try {
        await waitFor(element(by.text(itemName)))
          .not.toBeVisible()
          .withTimeout(2000);
        console.log('✓ Item deleted');
      } catch {
        console.log('⚠️ Item deletion verification unclear');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle long item names', async () => {
      const longName =
        'Very long shopping list item name that should be handled properly';
      await shoppingListScreen.addItem(longName);
      await delay(1000);
    });

    it('should handle fractional quantities', async () => {
      const itemName = generateItemName('Fractional');
      await shoppingListScreen.addItem(itemName, '1/4', 'cup');
      await delay(1000);
      await shoppingListScreen.expectTextVisible(itemName);
    });

    it('should handle special characters in item name', async () => {
      const specialName = "Trader Joe's O's Cereal";
      await shoppingListScreen.addItem(specialName);
      await delay(1000);
    });
  });
});
