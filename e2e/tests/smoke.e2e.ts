/**
 * Smoke tests — the only e2e file `e2e-smoke-tests.yml` runs on a PR, so the
 * last thing standing between a regression and `main`. It asserts
 * UNCONDITIONALLY: a known authenticated session is bootstrapped first and the
 * suite fails if that cannot be established. Never branch on the screen shown.
 */
import { element, by, waitFor, expect } from 'detox';
import { bootstrapAuthenticatedSession } from '../helpers';
import { TIMEOUTS } from '../helpers/waitFor';

/** Tab id → the screen that tab must render. Both sides are real testIDs in
 *  `src/`; a tab that navigates nowhere fails here rather than being skipped. */
const TABS: ReadonlyArray<[tab: string, screen: string]> = [
  ['tab-pantry', 'pantry-screen'],
  ['tab-shoppinglist', 'shopping-list-screen'],
  ['tab-recipe', 'recipes-screen'],
  ['tab-mealplan', 'meal-plan-screen'],
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
    await waitFor(element(by.id('tab-bar')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG);
  });

  it('renders the tab bar with every tab', async () => {
    await waitFor(element(by.id('tab-bar')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.DEFAULT);

    for (const [tab] of TABS) {
      await expect(element(by.id(tab))).toExist();
    }
    await expect(element(by.id('tab-profile'))).toExist();
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
