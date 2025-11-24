/**
 * Core user journeys
 *
 * A focused suite that exercises the primary happy-path flows without
 * duplicating coverage across multiple files. These tests prioritize
 * stability over exhaustive edge cases.
 */

import {
  bootstrapAuthenticatedSession,
  relaunchToHomeTab,
} from '../helpers/flows';
import { PantryScreen, ShoppingListScreen, RecipesScreen } from '../screens';

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

    // Verify screen loaded successfully (recipes may be empty for test user)
    // Just check that the screen is functional without errors
    await recipesScreen.expectScreenVisible();
  });
});
