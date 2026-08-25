/**
 * UI Tour — visual smoke test + screenshot capture.
 *
 * Logs in, asserts the authenticated tab bar and the four primary tabs are
 * reachable, and screenshots every primary surface (Pantry / Shopping /
 * Recipes / Meal Plan / Profile / add sheet) into the Detox artifacts dir for
 * visual review and regression.
 *
 * Main-tab navigation is ASSERTED (the test fails if a primary surface is
 * unreachable); the secondary captures (Profile, add sheet, Purchased sub-tab)
 * and all screenshots are best-effort. The LogBox dev-warning toast is
 * auto-silenced under Detox (see `useStartupInit`) so it can't occlude the
 * floating tab bar — no manual setup needed.
 *
 * Run:  npx detox test -c ios.sim.debug    e2e/tests/ui-tour.e2e.ts
 *       npx detox test -c android.emu.debug e2e/tests/ui-tour.e2e.ts
 * Out:  e2e/artifacts/<platform>/<run>/✓ UI Tour …/<name>.png
 */
import { device, element, by, waitFor, expect } from 'detox';
import {
  bootstrapAuthenticatedSession,
  dismissBiometricPromptIfPresent,
} from '../helpers/auth';

const settle = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const shoot = async (name: string) => {
  try {
    await device.takeScreenshot(name);
  } catch (e) {
    console.warn(`screenshot ${name} failed: ${e}`);
  }
};

const safe = async (label: string, fn: () => Promise<void>) => {
  try {
    await fn();
  } catch (e) {
    console.warn(`✗ ${label} skipped: ${e}`);
  }
};

// Dismiss post-login prompts bootstrap doesn't itself clear — notably the
// credential-save "Remember login info?" modal, which otherwise blocks the tabs.
const dismissByText = async (labels: string[]) => {
  for (const label of labels) {
    try {
      await element(by.text(label)).tap();
      await settle(500);
    } catch {
      /* label not present — keep going */
    }
  }
};

// Dismiss a SpotlightCoachMark tutorial if one is up.
//
// The coach mark renders a full-screen dimming overlay, so while it is showing
// EVERY tap lands on it rather than on the tab bar — Detox reports "View is not
// hittable at its visible point" against a target that is plainly visible in the
// screenshot, which reads as a layout bug rather than an overlay.
//
// `by.text` matches EXACTLY, and the button reads "Skip all" whenever the
// sequence has more than one step (`SpotlightCoachMark` picks `labels.skipAll`
// over `labels.skip` on `totalSteps > 1`). A list containing only 'Skip'
// therefore never matches the multi-step case — which is the common one. The
// accessibility label is the stable fallback: it is `tutorial.skipTutorial`
// regardless of step count, and the button carries no testID.
//
// Tutorial state persists once dismissed, so this is a no-op on every later run
// against the same install.
const dismissTutorialIfPresent = async () => {
  for (const matcher of [
    by.text('Skip all'),
    by.text('Skip'),
    by.label('Skip tutorial'),
  ]) {
    try {
      await element(matcher).atIndex(0).tap();
      await settle(600);
      return;
    } catch {
      /* not this one — try the next matcher */
    }
  }
};

// Navigate to a primary tab. The tab-visibility wait ASSERTS reachability (the
// test fails if a tab can't be reached); the screen-container wait is
// best-effort (its testID match is flaky under sync-disabled launches).
const goTab = async (tabId: string, screenId: string) => {
  await waitFor(element(by.id(tabId))).toBeVisible().withTimeout(10000);
  // Each surface can raise its own tutorial, so clear one before every tap
  // rather than only once after login.
  await dismissTutorialIfPresent();
  await element(by.id(tabId)).tap();
  try {
    await waitFor(element(by.id(screenId))).toBeVisible().withTimeout(4000);
  } catch {
    /* container testID flaky — settle + capture whatever rendered */
  }
  await settle(1200);
};

describe('UI Tour', () => {
  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
    await dismissByText(['Not Now', 'Maybe Later', 'Skip']);
    await dismissBiometricPromptIfPresent();
    await dismissByText(['Not Now', 'Skip', 'Got it', 'Dismiss']);
    await dismissTutorialIfPresent();
    await waitFor(element(by.id('tab-bar')))
      .toBeVisible()
      .withTimeout(15000);
    await settle(1000);
  });

  it('reaches and captures every primary surface', async () => {
    await expect(element(by.id('tab-bar'))).toBeVisible();
    await shoot('00-launch');

    await goTab('tab-pantry', 'pantry-screen');
    await shoot('01-pantry');

    await goTab('tab-shoppinglist', 'shopping-list-screen');
    await shoot('02-shopping');
    await safe('Shopping Purchased sub-tab', async () => {
      await element(by.text('Purchased')).atIndex(0).tap();
      await settle(700);
      await shoot('03-shopping-purchased');
    });

    await goTab('tab-recipe', 'recipes-screen');
    await shoot('04-recipes');

    await goTab('tab-mealplan', 'meal-plan-screen');
    await shoot('05-mealplan');

    // ── Secondary surfaces (best-effort so a hiccup never fails the smoke
    //    assertions above) ──
    await safe('Profile (header avatar)', async () => {
      await goTab('tab-pantry', 'pantry-screen');
      await element(by.id('tab-profile')).tap();
      try {
        await waitFor(element(by.id('profile-screen')))
          .toBeVisible()
          .withTimeout(6000);
      } catch {
        /* best-effort */
      }
      await settle(800);
      await shoot('06-profile');
    });

    await safe('Pantry add sheet', async () => {
      await goTab('tab-pantry', 'pantry-screen');
      await dismissBiometricPromptIfPresent();
      await element(by.id('tab-bar-add-button')).tap();
      await settle(900);
      await shoot('07-pantry-add-sheet');
    });
  });
});
