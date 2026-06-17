/**
 * UI Modernization Tour — read-only screenshot capture.
 *
 * Drives the authenticated app through every primary surface and captures a
 * screenshot of each, so the UI can be reviewed from real on-device renders.
 * Every step runs inside `safe()` so a single navigation failure never aborts
 * the rest of the tour — partial coverage is better than none.
 *
 * Run:  npx detox test -c ios.sim.debug e2e/tests/ui-tour.e2e.ts
 * Out:  e2e/artifacts/ios-simulator/<run>/.../*.png
 */
import { device, element, by, waitFor } from 'detox';
import {
  bootstrapAuthenticatedSession,
  dismissBiometricPromptIfPresent,
} from '../helpers/auth';

const settle = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const shoot = async (name: string) => {
  try {
    await device.takeScreenshot(name);
    console.log(`📸 ${name}`);
  } catch (e) {
    console.warn(`screenshot ${name} failed: ${e}`);
  }
};

const safe = async (label: string, fn: () => Promise<void>) => {
  try {
    console.log(`▶︎ ${label}`);
    await fn();
  } catch (e) {
    console.warn(`✗ ${label} skipped: ${e}`);
  }
};

const tapTab = async (tabId: string, screenId?: string) => {
  await waitFor(element(by.id(tabId))).toBeVisible().withTimeout(8000);
  await element(by.id(tabId)).tap();
  // The tap itself navigates reliably; the screen-container testID match is
  // flaky under sync-disabled launches, so wait for it only best-effort.
  if (screenId) {
    try {
      await waitFor(element(by.id(screenId))).toBeVisible().withTimeout(4000);
    } catch {
      /* fall through — settle + screenshot whatever rendered */
    }
  }
  await settle(1400); // slide transition + first paint
};

// Best-effort dismissal of post-login prompts/overlays by visible button text.
// bootstrapAuthenticatedSession only knows the biometric prompt, not the
// "Remember login info?" credential-save prompt that blocks the tabs.
const dismissByText = async (labels: string[]) => {
  for (const label of labels) {
    try {
      await element(by.text(label)).tap();
      await settle(600);
    } catch {
      /* label not present — keep going */
    }
  }
};

describe('UI Tour', () => {
  beforeAll(async () => {
    try {
      await bootstrapAuthenticatedSession();
    } catch (e) {
      console.warn(`bootstrap failed, recovering: ${e}`);
    }
    // Clear post-login prompts bootstrap doesn't handle (credential-save modal,
    // biometric, feature-hint) so we reach the authenticated tabs.
    await dismissByText(['Not Now', 'Remember', 'Maybe Later', 'Skip']);
    await dismissBiometricPromptIfPresent();
    await dismissByText(['Not Now', 'Skip', 'Got it', 'Dismiss']);
    try {
      await waitFor(element(by.id('tab-bar')))
        .toBeVisible()
        .withTimeout(12000);
    } catch {
      console.warn('tab-bar not visible after login recovery');
    }
    await settle(1200);
  });

  it('captures every primary surface', async () => {
    await shoot('00-launch');

    await safe('Pantry', async () => {
      await tapTab('tab-pantry', 'pantry-screen');
      await shoot('01-pantry-main');
    });

    await safe('Shopping', async () => {
      await tapTab('tab-shoppinglist', 'shopping-list-screen');
      await shoot('02-shopping-toBuy');
      try {
        await element(by.text('Purchased')).atIndex(0).tap();
        await settle(800);
        await shoot('03-shopping-purchased');
      } catch {
        /* purchased tab label not found — skip */
      }
    });

    await safe('Recipes', async () => {
      await tapTab('tab-recipe', 'recipes-screen');
      await shoot('04-recipes-main');
    });

    await safe('MealPlan', async () => {
      await tapTab('tab-mealplan', 'meal-plan-screen');
      await shoot('05-mealplan-main');
    });

    await safe('Profile', async () => {
      await tapTab('tab-pantry', 'pantry-screen');
      await element(by.id('tab-profile')).tap();
      try {
        await waitFor(element(by.id('profile-screen')))
          .toBeVisible()
          .withTimeout(6000);
      } catch {
        /* best-effort */
      }
      await settle(900);
      await shoot('06-profile-main');
    });

    // ── Data-dependent / modal interactions LAST, so the captures above are
    //    already safely on disk if any of these get stuck. ──
    await safe('Recipe detail', async () => {
      await tapTab('tab-recipe', 'recipes-screen');
      await settle(2800); // let cards finish loading (skeletons → content)
      // Recipe cards have id-based testIDs — tap the first card by point.
      await element(by.id('recipes-list')).tap({ x: 160, y: 120 });
      try {
        await waitFor(element(by.id('recipe-detail-screen')))
          .toBeVisible()
          .withTimeout(6000);
      } catch {
        /* best-effort */
      }
      await settle(1100);
      await shoot('07-recipe-detail');
    });

    await safe('Pantry add sheet', async () => {
      await tapTab('tab-pantry', 'pantry-screen');
      await dismissBiometricPromptIfPresent();
      await element(by.id('tab-bar-add-button')).tap();
      await settle(900);
      await shoot('08-pantry-add-sheet');
    });
  });
});
