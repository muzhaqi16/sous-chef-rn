/**
 * Test Data Helpers
 *
 * Utilities for managing test data in E2E tests.
 * Provides methods to clear, seed, and manipulate test data.
 */

import { element, by, waitFor, device } from 'detox';
import { delay, TIMEOUTS, waitForScreen } from './waitFor';
import { tapByID } from './actions';

/**
 * Seed pantry with test items
 * @param items - Array of items to add
 */
export async function seedPantryItems(
  items: Array<{
    name: string;
    quantity?: string;
    unit?: string;
  }>,
): Promise<void> {
  console.log(`🌱 Seeding ${items.length} pantry items...`);

  // Navigate to pantry
  await tapByID('tab-pantry');
  await waitForScreen('pantry-screen', TIMEOUTS.DEFAULT);

  for (const item of items) {
    // Tap add button
    await tapByID('pantry-add-button');

    // Wait for add modal
    await waitFor(element(by.id('add-pantry-item-modal')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

    // Search for item and add manually
    await tapByID('add-manually-button');

    // Wait for details modal
    await waitFor(element(by.id('add-pantry-item-details-modal')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

    // Fill in item details
    const nameInput = element(by.id('add-pantry-item-name-input'));
    await nameInput.clearText();
    await nameInput.typeText(item.name);

    if (item.quantity) {
      const quantityInput = element(by.id('add-pantry-item-quantity-input'));
      await quantityInput.clearText();
      await quantityInput.typeText(item.quantity);
    }

    if (item.unit) {
      const unitInput = element(by.id('add-pantry-item-unit-picker'));
      await unitInput.clearText();
      await unitInput.typeText(item.unit);
    }

    // Submit
    await tapByID('add-pantry-item-submit-button');

    // Wait for modal to close
    await waitFor(element(by.id('add-pantry-item-details-modal')))
      .not.toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

    await delay(500);
  }

  console.log('✅ Pantry items seeded');
}

/**
 * Seed shopping list with test items
 * @param items - Array of items to add
 */
export async function seedShoppingListItems(
  items: Array<{
    name: string;
    quantity?: string;
    unit?: string;
  }>,
): Promise<void> {
  console.log(`🌱 Seeding ${items.length} shopping list items...`);

  // Navigate to shopping list
  await tapByID('tab-shoppinglist');
  await waitForScreen('shopping-list-screen', TIMEOUTS.DEFAULT);

  for (const item of items) {
    // Tap add button
    await tapByID('tab-bar-add-button');

    // Wait for add modal
    await waitFor(element(by.id('add-shopping-item-modal')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

    // Tap add manually
    await tapByID('add-manually-button');

    // Wait for add item screen
    await waitFor(element(by.id('add-item-modal')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

    // Fill in item details
    const nameInput = element(by.id('add-item-name-input'));
    await nameInput.clearText();
    await nameInput.typeText(item.name);

    if (item.quantity) {
      const quantityInput = element(by.id('add-item-quantity-input'));
      await quantityInput.clearText();
      await quantityInput.typeText(item.quantity);
    }

    if (item.unit) {
      const unitInput = element(by.id('add-item-unit-picker'));
      await unitInput.clearText();
      await unitInput.typeText(item.unit);
    }

    // Submit
    await tapByID('add-item-submit-button');

    // Wait for modal to close
    await waitFor(element(by.id('add-item-modal')))
      .not.toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

    await delay(500);
  }

  console.log('✅ Shopping list items seeded');
}

/**
 * Generate unique item name with timestamp
 * @param prefix - Prefix for the item name
 */
export function generateItemName(prefix = 'E2E'): string {
  return `${prefix} Item ${Date.now()}`;
}

/**
 * Generate random test email
 */
export function generateTestEmail(): string {
  return `test.user.${Date.now()}@example.com`;
}

/**
 * Verify item exists in list
 * @param listTestID - TestID of the list container
 * @param itemName - Name of the item to find
 */
export async function expectItemInList(
  listTestID: string,
  itemName: string,
): Promise<void> {
  console.log(`🔍 Looking for "${itemName}" in ${listTestID}...`);

  const list = element(by.id(listTestID));
  await waitFor(list).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);

  // Search for item by text
  await waitFor(element(by.text(itemName)))
    .toBeVisible()
    .withTimeout(TIMEOUTS.DEFAULT);

  console.log(`✅ Found "${itemName}" in list`);
}

/**
 * Verify item does not exist in list
 * @param listTestID - TestID of the list container
 * @param itemName - Name of the item that should not exist
 */
export async function expectItemNotInList(
  listTestID: string,
  itemName: string,
): Promise<void> {
  console.log(`🔍 Verifying "${itemName}" is not in ${listTestID}...`);

  await waitFor(element(by.text(itemName)))
    .not.toBeVisible()
    .withTimeout(TIMEOUTS.DEFAULT);

  console.log(`✅ "${itemName}" not found in list (as expected)`);
}

/**
 * Count items in a list
 * @param listTestIDPrefix - Prefix for item testIDs (e.g., 'pantry-item-' for pantry-item-0, pantry-item-1, etc.)
 */
export async function countListItems(listTestIDPrefix: string): Promise<number> {
  let count = 0;
  const maxItems = 100; // Safety limit

  for (let i = 0; i < maxItems; i++) {
    try {
      await waitFor(element(by.id(`${listTestIDPrefix}${i}`)))
        .toBeVisible()
        .withTimeout(500);
      count++;
    } catch {
      // No more items
      break;
    }
  }

  return count;
}

/**
 * Standard test data sets
 */
export const TestData = {
  pantryItems: [
    { name: 'Milk', quantity: '1', unit: 'gallon' },
    { name: 'Eggs', quantity: '12', unit: 'count' },
    { name: 'Bread', quantity: '1', unit: 'loaf' },
    { name: 'Butter', quantity: '1', unit: 'lb' },
    { name: 'Cheese', quantity: '8', unit: 'oz' },
  ],

  shoppingListItems: [
    { name: 'Apples', quantity: '6', unit: 'count' },
    { name: 'Bananas', quantity: '1', unit: 'bunch' },
    { name: 'Orange Juice', quantity: '1', unit: 'bottle' },
    { name: 'Pasta', quantity: '1', unit: 'box' },
    { name: 'Tomato Sauce', quantity: '2', unit: 'cans' },
  ],

  expiringItems: [
    { name: 'Yogurt', quantity: '4', unit: 'cups', expiresInDays: 2 },
    { name: 'Fresh Salad', quantity: '1', unit: 'bag', expiresInDays: 1 },
    { name: 'Deli Meat', quantity: '1', unit: 'package', expiresInDays: 3 },
  ],
};
