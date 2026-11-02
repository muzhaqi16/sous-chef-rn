/** The onboarding wizard is a separate screen per step, one class each. */

import { BaseScreen } from './BaseScreen';
import { onboardingTestIDs } from '../../src/features/onboarding/testIDs';
import { kitTestIDs } from '../../src/components/testIDs';

/**
 * Setup: selects or creates the home, pantry and list, then replaces itself
 * with the first question. It stops only when invitations are pending.
 */
export class OnboardingSetupScreen extends BaseScreen {
  protected screenID = onboardingTestIDs.setupScreen;

  async tapCreateHome() {
    await this.tapByID(onboardingTestIDs.setupCreateHome);
  }

  async tapSkipHome() {
    await this.tapByID(onboardingTestIDs.setupSkipHome);
  }
}

/** The household question: who the user cooks for. */
export class HouseholdStepScreen extends BaseScreen {
  protected screenID = onboardingTestIDs.householdScreen;

  async tapSkip() {
    await this.tapByID(onboardingTestIDs.skipButton(this.screenID));
  }
}

/** The dietary step: allergies, a diet and foods to avoid. */
export class DietaryStepScreen extends BaseScreen {
  protected screenID = onboardingTestIDs.dietaryScreen;

  async tapSkip() {
    await this.tapByID(onboardingTestIDs.skipButton(this.screenID));
  }
}

/** The receipt step: scan a receipt, or pick staples instead. */
export class ReceiptStepScreen extends BaseScreen {
  protected screenID = onboardingTestIDs.receiptScreen;

  async tapSkip() {
    await this.tapByID(onboardingTestIDs.skipButton(this.screenID));
  }

  async tapScan() {
    await this.tapByID(onboardingTestIDs.receiptScan);
  }

  async tapPickStaples() {
    await this.tapByID(onboardingTestIDs.receiptStaples);
  }
}

/** Staples, the receipt step's alternative: foods grouped by where they are kept. */
export class SelectPantryItemsScreen extends BaseScreen {
  protected screenID = onboardingTestIDs.selectPantryItemsScreen;

  async tapSkip() {
    await this.tapByID(onboardingTestIDs.skipButton(this.screenID));
  }

  async tapBack() {
    await this.tapByID(kitTestIDs.headerBackButton);
  }

  // Item selection is AnimatedChip components with no testIDs — a test can
  // assert the screen is present and skip.
}

/** The completion screen, the last. */
export class OnboardingCompleteScreen extends BaseScreen {
  protected screenID = onboardingTestIDs.completeScreen;

  async expectCompletionMessage() {
    await this.waitForScreen();
  }
}
