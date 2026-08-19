/**
 * Smoke Tests — the gate that blocks pull requests.
 *
 * This suite is the only e2e file `e2e-smoke-tests.yml` runs on a PR, so it is
 * the last thing standing between a regression and `main`. It therefore asserts
 * unconditionally.
 *
 * The previous version branched on whichever screen happened to appear and
 * skipped when it guessed wrong. Because those branches gated on mutually
 * exclusive states (on-landing / on-login / logged-in), at most one could ever
 * assert; the other two passed by printing "⊘ skipping". A missing tab bar was
 * indistinguishable from a signed-out launch, so the suite reported success on
 * an app that could not render its own navigation.
 *
 * The fix is to remove the guessing: bootstrap a known authenticated session
 * before the suite runs, then assert against it. If the session cannot be
 * established the suite fails, which is the correct outcome — an app that
 * cannot be signed into has not passed a smoke test.
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
    // splash is absent.
    //
    // `waitFor(by.id('splash-screen')).not.toBeVisible()` was the whole test,
    // and it could not fail. `SplashScreen` is a real component
    // (`src/screens/SplashScreen.tsx`), but `beforeAll` has already launched the
    // app and waited for it to settle, so the splash is gone before this line
    // runs — and a `not.toBeVisible()` on something absent passes the instant it
    // is evaluated. It held for any app state whatsoever, a crash included.
    //
    // The splash half is not recoverable here: nothing in this test can observe
    // the splash to begin with, so there is no "it was there, now it is gone"
    // to assert. What IS checkable is that the launch arrived somewhere real.
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
    // A real interaction, unlike the "should not crash during basic
    // interactions" test this replaces — that one performed no interaction and
    // asserted only that the splash screen was gone.
    await element(by.id(tab)).tap();
    // LONG, not NETWORK: a cold CI simulator is materially slower than a warm
    // local one, and a smoke gate that flakes gets ignored.
    await waitFor(element(by.id(screen)))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG);
  });
});
