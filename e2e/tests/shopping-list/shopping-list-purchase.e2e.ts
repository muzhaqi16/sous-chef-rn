/**
 * Shopping list purchase: marking via the checkbox, and moving between the
 * Shopping and Purchased tabs.
 */

import { element, by, waitFor } from 'detox';
import { ShoppingListScreen } from '../../screens/ShoppingListScreen';
import { bootstrapAuthenticatedSession } from '../../helpers/auth';
import { relaunchToHomeTab } from '../../helpers/flows';
import { generateItemName } from '../../helpers/data';
import { TIMEOUTS } from '../../helpers/waitFor';
import { shoppingListTestIDs } from '../../../src/features/shoppingList/testIDs';

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
      await shoppingListScreen.waitForScreen(10000);

      const itemName = generateItemName('Purchase');
      await shoppingListScreen.addItem(itemName);

      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      const checkbox = element(
        by.id(shoppingListTestIDs.anyItemCheckbox()),
      ).atIndex(0);
      await waitFor(checkbox).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await checkbox.tap();

      await shoppingListScreen.openFilterTab('purchased');

      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await shoppingListScreen.openFilterTab('shopping');
      await shoppingListScreen.waitForScreen();
    });
  });

  describe('Shopping List Basic', () => {
    it('should verify shopping list is visible', async () => {
      await shoppingListScreen.waitForScreen(TIMEOUTS.DEFAULT);
    });

    it('should be able to add an item', async () => {
      const itemName = generateItemName('Bread');
      await shoppingListScreen.addItem(itemName);
      await waitFor(element(by.text(itemName)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should be able to navigate between tabs', async () => {
      await shoppingListScreen.openFilterTab('purchased');
      await waitFor(shoppingListScreen.filterTab('purchased'))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await shoppingListScreen.openFilterTab('shopping');

      await shoppingListScreen.waitForScreen();
    });
  });
});
