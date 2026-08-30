/** The onboarding wizard is a separate screen per step, one class each. */

import { BaseScreen } from './BaseScreen';

/** Step 1: create or join a home. */
export class CreateHomeScreen extends BaseScreen {
  protected screenID = 'onboarding-create-home-screen';

  async tapSkip() {
    await this.tapByID(`${this.screenID}-skip-button`);
  }

  async tapBack() {
    await this.tapByID(`${this.screenID}-back-button`);
  }

  // No submit helper: the screen submits its own form, so a test drives the
  // fields directly or waits for the navigation.
}

/** Step 2: create a shopping list. */
export class CreateShoppingListScreen extends BaseScreen {
  protected screenID = 'onboarding-create-shopping-list-screen';

  async tapSkip() {
    await this.tapByID(`${this.screenID}-skip-button`);
  }

  async tapBack() {
    await this.tapByID(`${this.screenID}-back-button`);
  }
}

/** Step 3: select initial pantry items. */
export class SelectPantryItemsScreen extends BaseScreen {
  protected screenID = 'onboarding-select-pantry-items-screen';

  async tapSkip() {
    await this.tapByID(`${this.screenID}-skip-button`);
  }

  async tapBack() {
    await this.tapByID(`${this.screenID}-back-button`);
  }

  // Item selection is AnimatedChip components with no testIDs — a test can
  // assert the screen is present and skip.
}

/** Step 6 of 7: optional biometric authentication setup. */
export class BiometricSetupScreen extends BaseScreen {
  protected screenID = 'biometric-setup-screen';

  async tapSkip() {
    await this.tapByID('biometric-setup-skip');
  }

  async tapEnable() {
    await this.tapByID('biometric-setup-enable');
  }
}

/** Step 7 of 7, the last. */
export class OnboardingCompleteScreen extends BaseScreen {
  protected screenID = 'onboarding-complete-screen';

  async expectCompletionMessage() {
    await this.waitForScreen();
  }
}
