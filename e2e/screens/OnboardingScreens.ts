/**
 * Onboarding Screen Objects
 *
 * Screen object models for the onboarding wizard flow.
 * The onboarding uses a multi-step wizard with separate screens.
 */

import { BaseScreen } from './BaseScreen';

/**
 * CreateHomeScreen
 * Step 1: Create or join a home
 */
export class CreateHomeScreen extends BaseScreen {
  protected screenID = 'onboarding-create-home-screen';

  async tapSkip() {
    await this.tapByID(`${this.screenID}-skip-button`);
  }

  async tapBack() {
    await this.tapByID(`${this.screenID}-back-button`);
  }

  // Note: Form submission handled by CreateHomeScreen internally
  // Test will need to interact with form fields directly or wait for navigation
}

/**
 * CreateShoppingListScreen
 * Step 2: Create a shopping list
 */
export class CreateShoppingListScreen extends BaseScreen {
  protected screenID = 'onboarding-create-shopping-list-screen';

  async tapSkip() {
    await this.tapByID(`${this.screenID}-skip-button`);
  }

  async tapBack() {
    await this.tapByID(`${this.screenID}-back-button`);
  }
}

/**
 * SelectPantryItemsScreen
 * Step 3: Select initial pantry items
 */
export class SelectPantryItemsScreen extends BaseScreen {
  protected screenID = 'onboarding-select-pantry-items-screen';

  async tapSkip() {
    await this.tapByID(`${this.screenID}-skip-button`);
  }

  async tapBack() {
    await this.tapByID(`${this.screenID}-back-button`);
  }

  // Note: Item selection uses AnimatedChip components
  // Tests can verify screen presence and skip to next step
}

/**
 * BiometricSetupScreen
 * Step 7: Set up biometric authentication (optional)
 */
export class BiometricSetupScreen extends BaseScreen {
  protected screenID = 'biometric-setup-screen';

  async tapSkip() {
    await this.tapByID('biometric-setup-skip');
  }

  async tapEnable() {
    await this.tapByID('biometric-setup-enable');
  }
}

/**
 * OnboardingCompleteScreen
 * Final step: Completion screen
 */
export class OnboardingCompleteScreen extends BaseScreen {
  protected screenID = 'onboarding-complete-screen';

  async expectCompletionMessage() {
    // Verify completion screen is showing
    await this.waitForScreen();
  }
}
