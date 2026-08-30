/**
 * Core user journeys — the primary happy paths, without duplicating coverage
 * across the other suites. Stability over exhaustive edge cases.
 */

import { relaunchToHomeTab } from '../helpers/flows';
import { bootstrapAuthenticatedSession } from '../helpers/auth';
import { PantryScreen } from '../screens/PantryScreen';
import { RecipesScreen } from '../screens/RecipesScreen';
import { ShoppingListScreen } from '../screens/ShoppingListScreen';

describe('Core app flows', () => {
  const pantryScreen = new PantryScreen();
  const shoppingListScreen = new ShoppingListScreen();
  const recipesScreen = new RecipesScreen();

  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
  });

  beforeEach(async () => {
    await relaunchToHomeTab();
  });

  it('lands on pantry after login', async () => {
    await pantryScreen.expectScreenVisible();
    await pantryScreen.expectVisible('pantry-add-button');
  });

  it('adds a pantry item', async () => {
    const itemName = `E2E Pantry Item ${Date.now()}`;

    await pantryScreen.addItem(itemName, '1', 'lb');
    await pantryScreen.waitForListToLoad();
    await pantryScreen.expectTextVisible(itemName);
  });

  it('adds to shopping list', async () => {
    const listItemName = `E2E Shopping Item ${Date.now()}`;

    await shoppingListScreen.navigateToTab();
    await shoppingListScreen.waitForScreen();
    await shoppingListScreen.addItem(listItemName, '1', 'lb');
    await shoppingListScreen.expectTextVisible(listItemName);
  });

  it('browses recipes list', async () => {
    await recipesScreen.navigateToTab();
    await recipesScreen.waitForScreen();

    // Recipes may be empty for the test user — assert the screen renders only.
    await recipesScreen.expectScreenVisible();
  });
});
