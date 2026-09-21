/** The onboarding wizard is a separate screen per step, one class each. */

import { BaseScreen } from './BaseScreen';
import { onboardingTestIDs } from '../../src/features/onboarding/testIDs';
import { kitTestIDs } from '../../src/components/testIDs';

/** Step 1: create or join a home. It renders no back button. */
export class CreateHomeScreen extends BaseScreen {
  protected screenID = onboardingTestIDs.createHomeScreen;

  async tapSkip() {
    await this.tapByID(onboardingTestIDs.skipButton(this.screenID));
  }

  // No submit helper: the screen submits its own form, so a test drives the
  // fields directly or waits for the navigation.
}

/** Step 2: create a shopping list. It renders no back button. */
export class CreateShoppingListScreen extends BaseScreen {
  protected screenID = onboardingTestIDs.createShoppingListScreen;

  async tapSkip() {
    await this.tapByID(onboardingTestIDs.skipButton(this.screenID));
  }
}

/** Step 3: select initial pantry items. */
export class SelectPantryItemsScreen extends BaseScreen {
  protected screenID = onboardingTestIDs.selectPantryItemsScreen;

  async tapSkip() {
    await this.tapByID(onboardingTestIDs.skipButton(this.screenID));
  }

  async tapBack() {
    await this.tapByID(onboardingTestIDs.backButton(this.screenID));
  }

  // Item selection is AnimatedChip components with no testIDs — a test can
  // assert the screen is present and skip.
}

/** Step 6 of 7: optional biometric authentication setup. */
export class BiometricSetupScreen extends BaseScreen {
  protected screenID = onboardingTestIDs.biometricSetupScreen;

  async tapSkip() {
    await this.tapByID(
      kitTestIDs.biometricSkip(onboardingTestIDs.biometricSetupView),
    );
  }

  async tapEnable() {
    await this.tapByID(
      kitTestIDs.biometricEnable(onboardingTestIDs.biometricSetupView),
    );
  }
}

/** Step 7 of 7, the last. */
export class OnboardingCompleteScreen extends BaseScreen {
  protected screenID = onboardingTestIDs.completeScreen;

  async expectCompletionMessage() {
    await this.waitForScreen();
  }
}
