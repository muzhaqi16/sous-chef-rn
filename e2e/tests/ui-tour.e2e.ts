/**
 * UI Tour — logs in, ASSERTS the tab bar and four primary tabs are reachable,
 * then screenshots every surface; secondary captures are best-effort. The
 * LogBox dev-warning toast is auto-silenced under Detox (`useStartupInit`) so
 * it can't occlude the floating tab bar. Out: e2e/artifacts/<platform>/<run>/.
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

// Dismiss a SpotlightCoachMark tutorial if one is up. Its full-screen dimming
// overlay swallows EVERY tap, and Detox reports "View is not hittable at its
// visible point" against a target plainly visible in the screenshot.
// `by.text` matches EXACTLY and the button reads "Skip all" whenever
// `totalSteps > 1`, so the accessibility label is the stable fallback — the
// button carries no testID. A no-op on later runs; the state persists.
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

    // Secondary surfaces — best-effort, so a hiccup never fails the assertions
    // above.
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
