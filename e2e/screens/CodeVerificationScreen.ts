import { waitFor } from 'detox';
import { BaseScreen } from './BaseScreen';
import { authTestIDs } from '../../src/features/auth/testIDs';

/**
 * Code entry, where a submitted sign-up form lands. Its code input takes focus
 * on mount, so the keyboard is up whenever this screen is.
 */
export class CodeVerificationScreen extends BaseScreen {
  protected screenID = authTestIDs.codeVerificationScreen;

  /** `AuthFormTemplate`'s title row — above the keyboard on every auth screen. */
  protected override blurTarget = authTestIDs.formTitleRow;

  private readonly resendLink = authTestIDs.codeVerificationResendLink;
  private readonly signInLink = authTestIDs.codeVerificationSignInLink;

  /** Bare `toBeVisible()` wants ~75% of the container, and the keyboard covers it. */
  override async waitForScreen(timeout: number = 5000) {
    await waitFor(this.screen).toBeVisible(1).withTimeout(timeout);
  }

  /** Existence only: the link sits in its post-registration cooldown. */
  async expectResendOffered() {
    await this.expectExists(this.resendLink);
  }

  /** "Already verified? Sign in" — the sign-up path's only way on. */
  async tapSignIn() {
    await this.tapPastKeyboard(this.signInLink);
  }
}
