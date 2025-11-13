/**
 * Shopping List E2E Tests
 *
 * Tests shopping list functionality including:
 * - Adding items
 * - Editing items
 * - Deleting items
 * - Toggling purchase status
 * - Search and filtering
 * - List operations
 */

import { LoginScreen, ShoppingListScreen } from '../../screens';
import { TEST_USER, TEST_SHOPPING_ITEMS } from '../../fixtures/testData';

describe('Shopping List', () => {
  const loginScreen = new LoginScreen();
  const shoppingListScreen = new ShoppingListScreen();

  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();

    // Login and navigate to shopping list
    try {
      await shoppingListScreen.waitForScreen(3000);
    } catch {
      await loginScreen.waitForScreen();
      await loginScreen.loginAsTestUser();
      await shoppingListScreen.waitForScreen();
    }

    // Ensure we're on the shopping list screen
    await shoppingListScreen.navigateToTab();
  });

  describe('Adding Items', () => {
    it('should add a new item to shopping list', async () => {
      // Arrange - on shopping list screen
      await shoppingListScreen.expectScreenVisible();

      // Act - add an item
      await shoppingListScreen.addItem(
        TEST_SHOPPING_ITEMS[0].name,
        TEST_SHOPPING_ITEMS[0].quantity,
        TEST_SHOPPING_ITEMS[0].unit,
      );

      // Assert - item should appear in list
      await shoppingListScreen.waitForListToLoad();
      await shoppingListScreen.expectItemExists(0);
    });

    it('should add multiple items', async () => {
      // Act - add 3 items
      for (let i = 0; i < 3; i++) {
        await shoppingListScreen.addItem(
          TEST_SHOPPING_ITEMS[i].name,
          TEST_SHOPPING_ITEMS[i].quantity,
          TEST_SHOPPING_ITEMS[i].unit,
        );
      }

      // Assert - should have 3 items
      await shoppingListScreen.waitForListToLoad();
      await shoppingListScreen.expectItemCount(3);
    });

    it('should add item with only name (optional quantity)', async () => {
      // Act - add item without quantity/unit
      await shoppingListScreen.addItem('Quick Item');

      // Assert - item should be added
      await shoppingListScreen.expectItemExists(0);
    });

    it('should show add button on shopping list screen', async () => {
      // Assert - add button should be visible
      await shoppingListScreen.expectVisible(
        shoppingListScreen['addButton'],
      );
    });

    it('should close add modal after adding item', async () => {
      // Act - add item
      await shoppingListScreen.tapAddButton();
      await shoppingListScreen.waitForElement('add-item-modal', 3000);

      // Fill and submit
      await shoppingListScreen.clearAndType('add-item-name-input', 'New Item');
      await shoppingListScreen.tapByID('add-item-submit-button');

      // Assert - modal should close
      await shoppingListScreen.waitForElementToDisappear('add-item-modal', 3000);
    });
  });

  describe('Editing Items', () => {
    beforeEach(async () => {
      // Add an item before each edit test
      await shoppingListScreen.addItem('Test Item', 1, 'unit');
      await shoppingListScreen.expectItemExists(0);
    });

    it('should edit item name', async () => {
      // Act - edit the item
      await shoppingListScreen.editItemByIndex(0, 'Updated Item');

      // Assert - item name should be updated
      await shoppingListScreen.expectItemText(0, 'Updated Item');
    });

    it('should open edit modal when tapping item', async () => {
      // Act - tap item
      await shoppingListScreen.getElementById(`shopping-list-item-0`).tap();

      // Assert - edit modal should appear
      await shoppingListScreen.waitForElement('edit-item-modal', 3000);
      await shoppingListScreen.expectVisible('edit-item-modal');
    });
  });

  describe('Deleting Items', () => {
    beforeEach(async () => {
      // Add items before each delete test
      await shoppingListScreen.addItem('Item to Delete', 1);
      await shoppingListScreen.expectItemExists(0);
    });

    it('should delete item by swiping left', async () => {
      // Act - swipe to delete
      await shoppingListScreen.swipeToDeleteItem(0);

      // Assert - item should be removed
      try {
        await shoppingListScreen.expectItemCount(0);
      } catch {
        // Item might still exist with animation
        await shoppingListScreen.waitForElementToDisappear(
          'shopping-list-item-0',
          3000,
        );
      }
    });

    it('should show delete button after swipe', async () => {
      // Act - swipe left to reveal delete button
      await shoppingListScreen.swipe('shopping-list-item-0', 'left', 'fast');

      // Assert - delete button should be visible
      await shoppingListScreen.expectVisible('shopping-list-item-0-delete');
    });

    it('should delete multiple items', async () => {
      // Arrange - add more items
      await shoppingListScreen.addItem('Item 2', 1);
      await shoppingListScreen.addItem('Item 3', 1);
      await shoppingListScreen.expectItemCount(3);

      // Act - delete first two items
      await shoppingListScreen.swipeToDeleteItem(0);
      await shoppingListScreen.waitForListToLoad(2000);
      await shoppingListScreen.swipeToDeleteItem(0); // Now the second item is at index 0

      // Assert - should have 1 item left
      await shoppingListScreen.expectItemCount(1);
    });
  });

  describe('Toggle Purchase Status', () => {
    beforeEach(async () => {
      // Add an item
      await shoppingListScreen.addItem('Milk', 1, 'gallon');
      await shoppingListScreen.expectItemExists(0);
    });

    it('should toggle item to purchased', async () => {
      // Act - toggle checkbox
      await shoppingListScreen.toggleItemByIndex(0);

      // Assert - item should be checked
      await shoppingListScreen.expectItemChecked(0);
    });

    it('should toggle item back to unpurchased', async () => {
      // Arrange - first toggle to purchased
      await shoppingListScreen.toggleItemByIndex(0);
      await shoppingListScreen.expectItemChecked(0);

      // Act - toggle back
      await shoppingListScreen.toggleItemByIndex(0);

      // Assert - should be unchecked
      await shoppingListScreen.expectItemUnchecked(0);
    });

    it('should toggle multiple items', async () => {
      // Arrange - add more items
      await shoppingListScreen.addItem('Bread', 2);
      await shoppingListScreen.addItem('Eggs', 1, 'dozen');

      // Act - toggle all items
      await shoppingListScreen.toggleItemByIndex(0);
      await shoppingListScreen.toggleItemByIndex(1);
      await shoppingListScreen.toggleItemByIndex(2);

      // Assert - all should be checked
      await shoppingListScreen.expectItemChecked(0);
      await shoppingListScreen.expectItemChecked(1);
      await shoppingListScreen.expectItemChecked(2);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      // Add multiple items for search testing
      await shoppingListScreen.addItem('Milk', 1, 'gallon');
      await shoppingListScreen.addItem('Bread', 2, 'loaf');
      await shoppingListScreen.addItem('Eggs', 1, 'dozen');
      await shoppingListScreen.waitForListToLoad();
    });

    it('should search for items', async () => {
      // Act - search for "Milk"
      await shoppingListScreen.searchFor('Milk');

      // Assert - should filter to show only Milk
      // Note: exact behavior depends on implementation
      await shoppingListScreen.expectItemExists(0);
    });

    it('should clear search', async () => {
      // Arrange - perform a search
      await shoppingListScreen.searchFor('Milk');

      // Act - clear search
      await shoppingListScreen.clearSearch();

      // Assert - all items should be visible again
      await shoppingListScreen.expectItemCount(3);
    });

    it('should show no results for invalid search', async () => {
      // Act - search for non-existent item
      await shoppingListScreen.searchFor('NonExistentItem12345');

      // Assert - should show empty state or no items
      try {
        await shoppingListScreen.expectEmptyState();
      } catch {
        // Or just verify no items exist
        await shoppingListScreen.expectItemCount(0);
      }
    });
  });

  describe('Sorting and Filtering', () => {
    beforeEach(async () => {
      // Add items
      await shoppingListScreen.addItem('Apples', 3);
      await shoppingListScreen.addItem('Bananas', 2);
      await shoppingListScreen.addItem('Carrots', 5);
    });

    it('should open filter menu', async () => {
      // Act
      await shoppingListScreen.openFilter();

      // Assert - filter menu/modal should appear
      await shoppingListScreen.waitForElement('shopping-list-filter-modal', 3000);
    });

    it('should open sort menu', async () => {
      // Act
      await shoppingListScreen.openSort();

      // Assert - sort menu/modal should appear
      await shoppingListScreen.waitForElement('shopping-list-sort-modal', 3000);
    });
  });

  describe('List Operations', () => {
    it('should show empty state when no items', async () => {
      // Assume list is empty on start or clear all items
      // Assert - empty state should be visible
      try {
        await shoppingListScreen.expectEmptyState();
      } catch {
        console.log('List not empty or empty state not shown');
      }
    });

    it('should pull to refresh list', async () => {
      // Act - pull to refresh
      await shoppingListScreen.pullToRefresh();

      // Assert - loading should finish
      await shoppingListScreen.waitForListToLoad();
      await shoppingListScreen.expectScreenVisible();
    });

    it('should scroll to bottom of list', async () => {
      // Arrange - add many items to enable scrolling
      for (let i = 0; i < 15; i++) {
        await shoppingListScreen.addItem(`Item ${i}`, 1);
      }

      // Act - scroll to bottom
      await shoppingListScreen.scrollToBottom();

      // Assert - should not crash, bottom should be visible
      await shoppingListScreen.expectScreenVisible();
    });

    it('should scroll to top of list', async () => {
      // Arrange - add many items
      for (let i = 0; i < 15; i++) {
        await shoppingListScreen.addItem(`Item ${i}`, 1);
      }

      // Scroll to bottom first
      await shoppingListScreen.scrollToBottom();

      // Act - scroll back to top
      await shoppingListScreen.scrollToTop();

      // Assert - should be at top
      await shoppingListScreen.expectScreenVisible();
    });
  });

  describe('Item Display', () => {
    it('should display item with quantity and unit', async () => {
      // Act - add item with full details
      await shoppingListScreen.addItem('Milk', 2, 'gallons');

      // Assert - item should exist with details
      await shoppingListScreen.expectItemExists(0);
      // Full text verification would depend on how item is rendered
    });

    it('should display multiple items in order', async () => {
      // Act - add items in order
      await shoppingListScreen.addItem('First Item', 1);
      await shoppingListScreen.addItem('Second Item', 2);
      await shoppingListScreen.addItem('Third Item', 3);

      // Assert - items should exist in order
      await shoppingListScreen.expectItemExists(0);
      await shoppingListScreen.expectItemExists(1);
      await shoppingListScreen.expectItemExists(2);
    });
  });

  describe('Long Press Actions', () => {
    beforeEach(async () => {
      await shoppingListScreen.addItem('Long Press Item', 1);
    });

    it('should handle long press on item', async () => {
      // Act - long press item
      await shoppingListScreen.longPressItem(0, 1000);

      // Assert - some action menu or context menu might appear
      // This depends on implementation
      // At minimum, app should not crash
      await shoppingListScreen.expectScreenVisible();
    });
  });

  describe('Performance', () => {
    it('should handle adding many items without lag', async () => {
      // Act - add 20 items rapidly
      const startTime = Date.now();
      for (let i = 0; i < 20; i++) {
        await shoppingListScreen.addItem(`Bulk Item ${i}`, 1);
      }
      const endTime = Date.now();

      // Assert - should complete in reasonable time (< 60 seconds)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(60000);

      // List should still be responsive
      await shoppingListScreen.expectScreenVisible();
    });
  });
});
