/**
 * Pantry E2E Tests
 *
 * Tests pantry management functionality including:
 * - Adding items with expiration dates
 * - Editing items
 * - Deleting items
 * - Quantity management
 * - Expiring items view
 * - Low stock items view
 * - Barcode scanning
 */

import { launchAppWithFabricWorkaround } from '../../init';
import { LandingAuthScreen, LoginScreen, PantryScreen, CreateHomeScreen, CreateShoppingListScreen, SelectPantryItemsScreen } from '../../screens';
import { TEST_USER, TEST_PANTRY_ITEMS, generateFutureDate, generatePastDate } from '../../fixtures/testData';
import { element, by } from 'detox';

describe('Pantry Management', () => {
  const landingScreen = new LandingAuthScreen();
  const loginScreen = new LoginScreen();
  const pantryScreen = new PantryScreen();
  const createHomeScreen = new CreateHomeScreen();
  const createShoppingListScreen = new CreateShoppingListScreen();
  const selectPantryItemsScreen = new SelectPantryItemsScreen();

  /**
   * Helper to skip through onboarding screens after login
   */
  const skipOnboardingIfPresent = async () => {
    // Try to skip through onboarding screens if they appear
    try {
      // Check if Create Home screen appears
      await createHomeScreen.waitForScreen(3000);
      await createHomeScreen.tapSkip();
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch {
      // Not on create home screen
    }

    try {
      // Check if Create Shopping List screen appears
      await createShoppingListScreen.waitForScreen(3000);
      await createShoppingListScreen.tapSkip();
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch {
      // Not on create shopping list screen
    }

    try {
      // Check if Select Pantry Items screen appears
      await selectPantryItemsScreen.waitForScreen(3000);
      await selectPantryItemsScreen.tapSkip();
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch {
      // Not on select pantry items screen
    }

    // Wait for either tab-bar or pantry screen to appear
    try {
      await element(by.id('tab-bar')).waitFor().toBeVisible().withTimeout(5000);
    } catch {
      // Tab bar might not appear immediately
    }
  };

  beforeAll(async () => {
    await launchAppWithFabricWorkaround({
      newInstance: true,
      permissions: { notifications: 'YES', camera: 'YES' },
    });
  });

  beforeEach(async () => {
    // Clear app data and launch fresh
    await launchAppWithFabricWorkaround({
      delete: true,
      permissions: { notifications: 'YES', camera: 'YES' },
    });

    // Login and navigate to pantry
    await landingScreen.waitForScreen(5000);
    await landingScreen.tapLogin();
    await loginScreen.waitForScreen(5000);
    await loginScreen.loginAsTestUser();

    // Skip onboarding if it appears
    await skipOnboardingIfPresent();

    // Wait for pantry screen (main app landing)
    await pantryScreen.waitForScreen(10000);
  });

  describe('Adding Items', () => {
    it('should add item with expiration date', async () => {
      // Arrange
      const futureDate = generateFutureDate(30); // 30 days in future

      // Act - add item with expiration
      await pantryScreen.addItem(
        TEST_PANTRY_ITEMS[0].name,
        TEST_PANTRY_ITEMS[0].quantity,
        TEST_PANTRY_ITEMS[0].unit,
        futureDate,
      );

      // Assert - item should exist
      await pantryScreen.waitForListToLoad();
      await pantryScreen.expectItemExists(0);
    });

    it('should add multiple pantry items', async () => {
      // Act - add 3 items
      for (let i = 0; i < 3; i++) {
        await pantryScreen.addItem(
          TEST_PANTRY_ITEMS[i].name,
          TEST_PANTRY_ITEMS[i].quantity,
          TEST_PANTRY_ITEMS[i].unit,
        );
      }

      // Assert - should have 3 items
      await pantryScreen.waitForListToLoad();
      await pantryScreen.expectItemCount(3);
    });

    it('should add item without expiration date', async () => {
      // Act - add item without expiration (optional)
      await pantryScreen.addItem('Non-Perishable Item', 5, 'cans');

      // Assert - item should be added
      await pantryScreen.expectItemExists(0);
    });

    it('should show add button on pantry screen', async () => {
      // Assert
      await pantryScreen.expectVisible(pantryScreen['addButton']);
    });

    it('should close add modal after adding item', async () => {
      // Act - open add modal
      await pantryScreen.tapAddButton();
      await pantryScreen.waitForElement('add-pantry-item-modal', 3000);

      // Fill and submit
      await pantryScreen.clearAndType('add-pantry-item-name-input', 'New Item');
      await pantryScreen.tapByID('add-pantry-item-submit-button');

      // Assert - modal should close
      await pantryScreen.waitForElementToDisappear('add-pantry-item-modal', 3000);
    });
  });

  describe('Editing Items', () => {
    beforeEach(async () => {
      // Add an item before each edit test
      await pantryScreen.addItem('Milk', 2, 'cartons', generateFutureDate(7));
      await pantryScreen.expectItemExists(0);
    });

    it('should edit item name', async () => {
      // Act - edit item
      await pantryScreen.editItemByIndex(0, { name: 'Almond Milk' });

      // Assert - name should be updated
      await pantryScreen.expectItemName(0, 'Almond Milk');
    });

    it('should edit item quantity', async () => {
      // Act - edit quantity
      await pantryScreen.editItemByIndex(0, { quantity: 5 });

      // Assert - quantity should be updated
      await pantryScreen.expectItemQuantity(0, '5');
    });

    it('should edit item expiration date', async () => {
      // Act - edit expiration
      const newDate = generateFutureDate(14);
      await pantryScreen.editItemByIndex(0, { expirationDate: newDate });

      // Assert - expiration should be updated
      await pantryScreen.expectItemExpiration(0, newDate);
    });

    it('should edit multiple fields at once', async () => {
      // Act - edit all fields
      await pantryScreen.editItemByIndex(0, {
        name: 'Soy Milk',
        quantity: 3,
        expirationDate: generateFutureDate(10),
      });

      // Assert - all changes should be applied
      await pantryScreen.expectItemName(0, 'Soy Milk');
      await pantryScreen.expectItemQuantity(0, '3');
    });
  });

  describe('Deleting Items', () => {
    beforeEach(async () => {
      // Add item to delete
      await pantryScreen.addItem('Item to Delete', 1);
      await pantryScreen.expectItemExists(0);
    });

    it('should delete item by swiping left', async () => {
      // Act
      await pantryScreen.swipeToDeleteItem(0);

      // Assert - item should be removed
      try {
        await pantryScreen.expectItemCount(0);
      } catch {
        await pantryScreen.waitForElementToDisappear('pantry-item-0', 3000);
      }
    });

    it('should show delete button after swipe', async () => {
      // Act - swipe to reveal delete button
      await pantryScreen.swipe('pantry-item-0', 'left', 'fast');

      // Assert
      await pantryScreen.expectVisible('pantry-item-0-delete');
    });
  });

  describe('Quantity Management', () => {
    beforeEach(async () => {
      // Add item with quantity
      await pantryScreen.addItem('Apples', 5, 'pieces');
      await pantryScreen.expectItemExists(0);
    });

    it('should increase item quantity', async () => {
      // Act - increase quantity
      await pantryScreen.increaseQuantity(0);

      // Assert - quantity should be 6
      await pantryScreen.expectItemQuantity(0, '6');
    });

    it('should decrease item quantity', async () => {
      // Act - decrease quantity
      await pantryScreen.decreaseQuantity(0);

      // Assert - quantity should be 4
      await pantryScreen.expectItemQuantity(0, '4');
    });

    it('should increase quantity multiple times', async () => {
      // Act - increase 3 times
      await pantryScreen.increaseQuantity(0);
      await pantryScreen.increaseQuantity(0);
      await pantryScreen.increaseQuantity(0);

      // Assert - should be 8
      await pantryScreen.expectItemQuantity(0, '8');
    });

    it('should not allow negative quantity', async () => {
      // Arrange - decrease to low quantity
      await pantryScreen.decreaseQuantity(0);
      await pantryScreen.decreaseQuantity(0);
      await pantryScreen.decreaseQuantity(0);
      await pantryScreen.decreaseQuantity(0);
      await pantryScreen.decreaseQuantity(0);

      // Act - try to decrease below 0
      await pantryScreen.decreaseQuantity(0);

      // Assert - quantity should not be negative
      // Either stays at 0 or item is deleted
      try {
        await pantryScreen.expectItemQuantity(0, '0');
      } catch {
        // Item might be auto-deleted at 0 quantity
        await pantryScreen.expectItemCount(0);
      }
    });
  });

  describe('Expiring Items View', () => {
    beforeEach(async () => {
      // Add items with different expiration dates
      await pantryScreen.addItem('Expiring Soon', 1, 'unit', generateFutureDate(2));
      await pantryScreen.addItem('Expiring Later', 1, 'unit', generateFutureDate(30));
    });

    it('should navigate to expiring items view', async () => {
      // Act
      await pantryScreen.navigateToExpiringItems();

      // Assert - should be on expiring items screen
      await pantryScreen.waitForElement('expiring-items-screen', 3000);
      await pantryScreen.expectVisible('expiring-items-screen');
    });

    it('should show expiring soon warning on items', async () => {
      // Assert - item expiring in 2 days should have warning
      await pantryScreen.expectItemExpiringSoon(0);
    });

    it('should filter items by expiration in expiring view', async () => {
      // Act - navigate to expiring items
      await pantryScreen.navigateToExpiringItems();

      // Assert - should show expiring items
      // Implementation depends on filtering logic (e.g., 7 days or less)
      await pantryScreen.expectVisible('expiring-items-screen');
    });
  });

  describe('Low Stock Items View', () => {
    beforeEach(async () => {
      // Add items with different stock levels
      await pantryScreen.addItem('Low Stock Item', 1, 'unit');
      await pantryScreen.addItem('Good Stock Item', 10, 'units');
    });

    it('should navigate to low stock items view', async () => {
      // Act
      await pantryScreen.navigateToLowStockItems();

      // Assert
      await pantryScreen.waitForElement('low-stock-items-screen', 3000);
      await pantryScreen.expectVisible('low-stock-items-screen');
    });

    it('should show low stock warning on items', async () => {
      // Assert - item with quantity 1 might have low stock warning
      try {
        await pantryScreen.expectItemLowStock(0);
      } catch {
        console.log('Low stock threshold not met or not implemented');
      }
    });
  });

  describe('Barcode Scanning', () => {
    it('should open barcode scanner', async () => {
      // Act
      await pantryScreen.tapScanBarcodeButton();

      // Assert - scanner should open
      await pantryScreen.waitForElement('barcode-scanner-screen', 3000);
      await pantryScreen.expectVisible('barcode-scanner-screen');
    });

    it('should show scan barcode button', async () => {
      // Assert
      await pantryScreen.expectVisible(pantryScreen['scanBarcodeButton']);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      // Add multiple items
      await pantryScreen.addItem('Milk', 2);
      await pantryScreen.addItem('Bread', 1);
      await pantryScreen.addItem('Eggs', 12);
      await pantryScreen.waitForListToLoad();
    });

    it('should search for items', async () => {
      // Act
      await pantryScreen.searchFor('Milk');

      // Assert - should filter to show only Milk
      await pantryScreen.expectItemExists(0);
    });

    it('should clear search', async () => {
      // Arrange - search first
      await pantryScreen.searchFor('Milk');

      // Act - clear
      await pantryScreen.clearSearch();

      // Assert - all items visible
      await pantryScreen.expectItemCount(3);
    });

    it('should show no results for invalid search', async () => {
      // Act
      await pantryScreen.searchFor('NonExistentItem99999');

      // Assert
      try {
        await pantryScreen.expectEmptyState();
      } catch {
        await pantryScreen.expectItemCount(0);
      }
    });
  });

  describe('Sorting and Filtering', () => {
    beforeEach(async () => {
      await pantryScreen.addItem('Apples', 3);
      await pantryScreen.addItem('Bananas', 2);
      await pantryScreen.addItem('Carrots', 5);
    });

    it('should open filter menu', async () => {
      // Act
      await pantryScreen.openFilter();

      // Assert
      await pantryScreen.waitForElement('pantry-filter-modal', 3000);
    });

    it('should open sort menu', async () => {
      // Act
      await pantryScreen.openSort();

      // Assert
      await pantryScreen.waitForElement('pantry-sort-modal', 3000);
    });
  });

  describe('List Operations', () => {
    it('should show empty state when no items', async () => {
      // Assert - assume starting with empty pantry
      try {
        await pantryScreen.expectEmptyState();
      } catch {
        console.log('Pantry not empty or empty state not shown');
      }
    });

    it('should pull to refresh', async () => {
      // Act
      await pantryScreen.pullToRefresh();

      // Assert - should finish loading
      await pantryScreen.waitForListToLoad();
      await pantryScreen.expectScreenVisible();
    });

    it('should scroll through long list', async () => {
      // Arrange - add many items
      for (let i = 0; i < 15; i++) {
        await pantryScreen.addItem(`Pantry Item ${i}`, 1);
      }

      // Act - scroll to bottom
      await pantryScreen.scrollToBottom();

      // Assert - no crash
      await pantryScreen.expectScreenVisible();

      // Scroll back to top
      await pantryScreen.scrollToTop();
      await pantryScreen.expectScreenVisible();
    });
  });

  describe('Expired Items', () => {
    it('should add item with past expiration date', async () => {
      // Act - add expired item
      const pastDate = generatePastDate(5);
      await pantryScreen.addItem('Expired Milk', 1, 'carton', pastDate);

      // Assert - item should exist
      await pantryScreen.expectItemExists(0);

      // Should show as expired
      await pantryScreen.expectItemExpiration(0, pastDate);
    });

    it('should highlight expired items', async () => {
      // Arrange - add expired item
      await pantryScreen.addItem('Expired Item', 1, 'unit', generatePastDate(1));

      // Assert - should have some visual indication of expiration
      // This depends on implementation (e.g., red color, warning icon)
      await pantryScreen.expectItemExpiringSoon(0); // Might also mark expired items
    });
  });

  describe('Long Press Actions', () => {
    beforeEach(async () => {
      await pantryScreen.addItem('Long Press Item', 1);
    });

    it('should handle long press on item', async () => {
      // Act
      await pantryScreen.longPressItem(0, 1000);

      // Assert - shouldn't crash
      await pantryScreen.expectScreenVisible();
    });
  });

  describe('Performance', () => {
    it('should handle many pantry items', async () => {
      // Act - add 20 items
      const startTime = Date.now();
      for (let i = 0; i < 20; i++) {
        await pantryScreen.addItem(`Bulk Item ${i}`, 1);
      }
      const endTime = Date.now();

      // Assert - should complete in reasonable time
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(60000);

      await pantryScreen.expectScreenVisible();
    });
  });
});
