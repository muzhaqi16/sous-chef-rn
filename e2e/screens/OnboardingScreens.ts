/** The onboarding wizard is a separate screen per step, one class each. */

import { BaseScreen } from './BaseScreen';
import { onboardingTestIDs } from '../../src/features/onboarding/testIDs';

/**
 * Pending invitations with no home: create one's own, or none for now. Setup
 * otherwise runs beside the questions with no screen of its own.
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

/** The kitchen step: scan a receipt, and pick staples on the same screen. */
export class ReceiptStepScreen extends BaseScreen {
  protected screenID = onboardingTestIDs.receiptScreen;

  async tapSkip() {
    await this.tapByID(onboardingTestIDs.skipButton(this.screenID));
  }

  async tapScan() {
    await this.tapByID(onboardingTestIDs.receiptScan);
  }

}

/** The completion screen, the last. */
export class OnboardingCompleteScreen extends BaseScreen {
  protected screenID = onboardingTestIDs.completeScreen;

  async expectCompletionMessage() {
    await this.waitForScreen();
  }
}
