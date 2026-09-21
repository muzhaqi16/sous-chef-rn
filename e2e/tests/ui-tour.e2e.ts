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
import { kitTestIDs } from '../../src/components/testIDs';
import { mealPlanTestIDs } from '../../src/features/mealPlan/testIDs';
import { pantryTestIDs } from '../../src/features/pantry/testIDs';
import { profileTestIDs } from '../../src/features/profile/testIDs';
import { recipesTestIDs } from '../../src/features/recipes/testIDs';
import { shoppingListTestIDs } from '../../src/features/shoppingList/testIDs';

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

// Dismiss a SpotlightCoachMark tutorial if one is up. Its full-screen dimming
// overlay swallows EVERY tap, and Detox reports "View is not hittable at its
// visible point" against a target plainly visible in the screenshot. A no-op on
// later runs; the state persists.
const dismissTutorialIfPresent = async () => {
  try {
    await element(by.id(kitTestIDs.spotlightSkipButton)).atIndex(0).tap();
    await settle(600);
  } catch {
    /* no tutorial up */
  }
};

// Navigate to a primary tab. The tab-visibility wait ASSERTS reachability (the
// test fails if a tab can't be reached); the screen-container wait is
// best-effort (its testID match is flaky under sync-disabled launches).
const goTab = async (tabId: string, screenId: string) => {
  await waitFor(element(by.id(tabId)))
    .toBeVisible()
    .withTimeout(10000);
  // Each surface can raise its own tutorial, so clear one before every tap
  // rather than only once after login.
  await dismissTutorialIfPresent();
  await element(by.id(tabId)).tap();
  try {
    await waitFor(element(by.id(screenId)))
      .toBeVisible()
      .withTimeout(4000);
  } catch {
    /* container testID flaky — settle + capture whatever rendered */
  }
  await settle(1200);
};

describe('UI Tour', () => {
  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
    await dismissBiometricPromptIfPresent();
    await dismissTutorialIfPresent();
    await waitFor(element(by.id(kitTestIDs.tabBar)))
      .toBeVisible()
      .withTimeout(15000);
    await settle(1000);
  });

  it('reaches and captures every primary surface', async () => {
    await expect(element(by.id(kitTestIDs.tabBar))).toBeVisible();
    await shoot('00-launch');

    await goTab(kitTestIDs.tab('Pantry'), pantryTestIDs.screen);
    await shoot('01-pantry');

    await goTab(kitTestIDs.tab('ShoppingList'), shoppingListTestIDs.screen);
    await shoot('02-shopping');
    await safe('Shopping Purchased sub-tab', async () => {
      await element(
        by.id(
          kitTestIDs.filterTab(shoppingListTestIDs.tabBarPrefix, 'purchased'),
        ),
      ).tap();
      await settle(700);
      await shoot('03-shopping-purchased');
    });

    await goTab(kitTestIDs.tab('Recipe'), recipesTestIDs.recipesScreen);
    await shoot('04-recipes');

    await goTab(kitTestIDs.tab('MealPlan'), mealPlanTestIDs.screen);
    await shoot('05-mealplan');

    // Secondary surfaces — best-effort, so a hiccup never fails the assertions
    // above.
    await safe('Profile (header avatar)', async () => {
      await goTab(kitTestIDs.tab('Pantry'), pantryTestIDs.screen);
      await element(by.id(kitTestIDs.tab('Profile'))).tap();
      try {
        await waitFor(element(by.id(profileTestIDs.profileScreen)))
          .toBeVisible()
          .withTimeout(6000);
      } catch {
        /* best-effort */
      }
      await settle(800);
      await shoot('06-profile');
    });

    await safe('Pantry add sheet', async () => {
      await goTab(kitTestIDs.tab('Pantry'), pantryTestIDs.screen);
      await dismissBiometricPromptIfPresent();
      await element(by.id(kitTestIDs.tabBarAddButton)).tap();
      await settle(900);
      await shoot('07-pantry-add-sheet');
    });
  });
});
