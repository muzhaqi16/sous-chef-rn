import { by, element, waitFor } from 'detox';
import { BaseScreen } from './BaseScreen';
import { authTestIDs } from '../../src/features/auth/testIDs';
import { kitTestIDs } from '../../src/components/testIDs';

/**
 * Code entry: the verification gate a new account signs in to, or the
 * signed-out screen an address that refused the password lands on. Its code
 * input takes focus on mount, so the keyboard is up whenever this screen is.
 */
export class CodeVerificationScreen extends BaseScreen {
  protected screenID = authTestIDs.codeVerificationScreen;

  /** `AuthFormTemplate`'s title row — above the keyboard on every auth screen. */
  protected override blurTarget = authTestIDs.formTitleRow;

  private readonly resendLink = authTestIDs.codeVerificationResendLink;
  private readonly signInLink = authTestIDs.codeVerificationSignInLink;
  private readonly skipLink = authTestIDs.codeVerificationSkipLink;

  /** Bare `toBeVisible()` wants ~75% of the container, and the keyboard covers it. */
  override async waitForScreen(timeout: number = 5000) {
    await waitFor(this.screen).toBeVisible(1).withTimeout(timeout);
  }

  /** Existence only: the link sits in its post-registration cooldown. */
  async expectResendOffered() {
    await this.expectExists(this.resendLink);
  }

  /** "Already verified? Sign in" — the signed-out screen's only way on. */
  async tapSignIn() {
    await this.tapPastKeyboard(this.signInLink);
  }

  /** "Skip for now" on the gate, then its confirmation: [Cancel, Skip for now]. */
  async skip() {
    await this.tapPastKeyboard(this.skipLink);
    await waitFor(element(by.id(kitTestIDs.alertModal)))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id(kitTestIDs.alertButton(1))).tap();
  }
}
