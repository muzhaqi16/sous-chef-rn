/** Seeds pantry and shopping-list rows through the real UI. */

import { element, by, waitFor } from 'detox';
import { delay, TIMEOUTS, waitForScreen } from './waitFor';
import { tapByID } from './actions';

export async function seedPantryItems(
  items: Array<{
    name: string;
    quantity?: string;
    unit?: string;
  }>,
): Promise<void> {
  console.log(`🌱 Seeding ${items.length} pantry items...`);

  await tapByID('tab-pantry');
  await waitForScreen('pantry-screen', TIMEOUTS.DEFAULT);

  for (const item of items) {
    await tapByID('pantry-add-button');

    await waitFor(element(by.id('add-pantry-item-modal')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

    await tapByID('add-manually-button');

    await waitFor(element(by.id('add-pantry-item-details-modal')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

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

    await tapByID('add-pantry-item-submit-button');

    await waitFor(element(by.id('add-pantry-item-details-modal')))
      .not.toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

    await delay(500);
  }

  console.log('✅ Pantry items seeded');
}

export async function seedShoppingListItems(
  items: Array<{
    name: string;
    quantity?: string;
    unit?: string;
  }>,
): Promise<void> {
  console.log(`🌱 Seeding ${items.length} shopping list items...`);

  await tapByID('tab-shoppinglist');
  await waitForScreen('shopping-list-screen', TIMEOUTS.DEFAULT);

  for (const item of items) {
    await tapByID('tab-bar-add-button');

    await waitFor(element(by.id('add-shopping-item-modal')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

    await tapByID('add-manually-button');

    await waitFor(element(by.id('add-item-modal')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

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

    await tapByID('add-item-submit-button');

    await waitFor(element(by.id('add-item-modal')))
      .not.toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

    await delay(500);
  }

  console.log('✅ Shopping list items seeded');
}

export function generateItemName(prefix = 'E2E'): string {
  return `${prefix} Item ${Date.now()}`;
}

export function generateTestEmail(): string {
  return `test.user.${Date.now()}@example.com`;
}

export async function expectItemInList(
  listTestID: string,
  itemName: string,
): Promise<void> {
  console.log(`🔍 Looking for "${itemName}" in ${listTestID}...`);

  const list = element(by.id(listTestID));
  await waitFor(list).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);

  await waitFor(element(by.text(itemName)))
    .toBeVisible()
    .withTimeout(TIMEOUTS.DEFAULT);

  console.log(`✅ Found "${itemName}" in list`);
}

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

/** Counts index-keyed rows: `pantry-item-0`, `pantry-item-1`, … until one misses. */
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
      break;
    }
  }

  return count;
}

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
