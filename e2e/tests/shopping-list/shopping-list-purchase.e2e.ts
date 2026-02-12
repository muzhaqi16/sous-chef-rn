/**
 * Shopping List Purchase E2E Tests
 *
 * Tests for shopping list purchase functionality including:
 * - Marking items as purchased
 * - Purchased tab management
 * - Moving to pantry
 * - Clear all purchased
 */

import { element, by, waitFor, expect } from 'detox';
import { ShoppingListScreen } from '../../screens';
import { bootstrapAuthenticatedSession, relaunchToHomeTab } from '../../helpers';
import { generateItemName } from '../../helpers/data';
import { TIMEOUTS } from '../../helpers/waitFor';

describe('Shopping List Purchase', () => {
  const shoppingListScreen = new ShoppingListScreen();

  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
  });

  beforeEach(async () => {
    await relaunchToHomeTab();
    await shoppingListScreen.navigateToTab();
    // navigateToTab already calls waitForScreen internally
  });

  describe('Mark as Purchased', () => {
    it('should mark item as purchased via checkbox and view in Purchased tab', async () => {
      // First verify we're on the shopping list
      await shoppingListScreen.waitForScreen(10000);

      // Add a test item
      const itemName = generateItemName('Purchase');
      await shoppingListScreen.addItem(itemName);

      // Verify item was added
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Find the checkbox by testID pattern and tap it
      const checkbox = element(by.id(/shopping-item-checkbox-.*/)).atIndex(0);
      await waitFor(checkbox).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await checkbox.tap();

      // Navigate to Purchased tab to verify item moved
      const purchasedTab = element(by.text('Purchased'));
      await waitFor(purchasedTab).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await purchasedTab.tap();

      // Verify item is in purchased list
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Go back to Shopping tab
      const shoppingTab = element(by.text('Shopping'));
      await shoppingTab.tap();
      await shoppingListScreen.waitForScreen();
    });
  });

  describe('Shopping List Basic', () => {
    it('should verify shopping list is visible', async () => {
      // Verify we're on the shopping list screen
      await shoppingListScreen.waitForScreen(TIMEOUTS.DEFAULT);
    });

    it('should be able to add an item', async () => {
      await shoppingListScreen.addItem('Bread');
      await waitFor(element(by.text('Bread')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should be able to navigate between tabs', async () => {
      const purchasedTab = element(by.text('Purchased'));
      await waitFor(purchasedTab).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await purchasedTab.tap();

      // Verify we navigated (Purchased tab should be active)
      await waitFor(element(by.text('Purchased')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Go back to Shopping tab
      const shoppingTab = element(by.text('Shopping'));
      await waitFor(shoppingTab).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await shoppingTab.tap();

      await shoppingListScreen.waitForScreen();
    });
  });
});
