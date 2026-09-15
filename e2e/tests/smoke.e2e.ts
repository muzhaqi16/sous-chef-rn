/**
 * Smoke tests — the only e2e file `e2e-smoke-tests.yml` runs on a PR, so the
 * last thing standing between a regression and `main`. It asserts
 * UNCONDITIONALLY: a known authenticated session is bootstrapped first and the
 * suite fails if that cannot be established. Never branch on the screen shown.
 */
import { element, by, waitFor, expect } from 'detox';
import { bootstrapAuthenticatedSession } from '../helpers/auth';
import { TIMEOUTS } from '../helpers/waitFor';
import { kitTestIDs } from '../../src/components/testIDs';
import { mealPlanTestIDs } from '../../src/features/mealPlan/testIDs';
import { pantryTestIDs } from '../../src/features/pantry/testIDs';
import { recipesTestIDs } from '../../src/features/recipes/testIDs';
import { shoppingListTestIDs } from '../../src/features/shoppingList/testIDs';

/** Tab id → the screen that tab must render; a tab that navigates nowhere
 *  fails here rather than being skipped. */
const TABS: ReadonlyArray<[tab: string, screen: string]> = [
  [kitTestIDs.tab('Pantry'), pantryTestIDs.screen],
  [kitTestIDs.tab('ShoppingList'), shoppingListTestIDs.screen],
  [kitTestIDs.tab('Recipe'), recipesTestIDs.recipesScreen],
  [kitTestIDs.tab('MealPlan'), mealPlanTestIDs.screen],
];

describe('Smoke Tests', () => {
  beforeAll(async () => {
    // Deterministic starting state. Throws if the session cannot be
    // established, so the suite cannot silently degrade into "assert nothing".
    await bootstrapAuthenticatedSession();
  });

  it('launches into the app', async () => {
    // Asserts the state that must hold once the splash clears, NOT that the
    // splash is absent: `beforeAll` has already launched and settled the app, so
    // the splash is gone before this line runs — and `not.toBeVisible()` on
    // something absent passes instantly, for any app state, a crash included.
    await waitFor(element(by.id(kitTestIDs.tabBar)))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG);
  });

  it('renders the tab bar with every tab', async () => {
    await waitFor(element(by.id(kitTestIDs.tabBar)))
      .toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

    for (const [tab] of TABS) {
      await expect(element(by.id(tab))).toExist();
    }
    await expect(element(by.id(kitTestIDs.tab('Profile')))).toExist();
  });

  it.each(TABS)('navigates to %s and renders %s', async (tab, screen) => {
    await element(by.id(tab)).tap();
    // LONG, not NETWORK: a cold CI simulator is materially slower than a warm
    // local one, and a smoke gate that flakes gets ignored.
    await waitFor(element(by.id(screen)))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG);
  });
});
