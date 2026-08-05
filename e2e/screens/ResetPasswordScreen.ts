/**
 * ResetPasswordScreen
 *
 * Screen object model for the screen reached from a password-reset link,
 * where the user chooses their new password. Reached by deep link
 * (`souschef://reset-password?token=…`) rather than in-app navigation.
 */

import { BaseScreen } from './BaseScreen';

export class ResetPasswordScreen extends BaseScreen {
  protected screenID = 'reset-password-screen';

  private readonly newPasswordInput = 'reset-password-new-input';
  private readonly confirmPasswordInput = 'reset-password-confirm-input';
  private readonly submitButton = 'reset-password-submit-button';
  private readonly invalidLinkView = 'reset-password-invalid-link';

  async enterNewPassword(password: string) {
    await this.clearAndType(this.newPasswordInput, password);
  }

  async enterConfirmPassword(password: string) {
    await this.clearAndType(this.confirmPasswordInput, password);
  }

  /**
   * Drops the keyboard before pressing, matching ForgotPasswordScreen. Detox
   * taps an element's centre, and with the keyboard up the button's centre can
   * sit behind it — the tap then lands on a key instead, which would make a
   * "nothing happened" assertion pass without ever pressing the button.
   * Keyboard-open reachability is covered separately by
   * `expectFormReachableWithKeyboardOpen`.
   */
  async submit() {
    await this.dismissKeyboard();
    await this.tapByID(this.submitButton);
  }

  async resetPasswordTo(password: string) {
    await this.enterNewPassword(password);
    await this.enterConfirmPassword(password);
    await this.submit();
  }

  /**
   * The confirm field and the submit button must stay on screen while the
   * keyboard is open. Detox only reports a view visible when it is actually
   * unobscured, so a keyboard sitting over either one fails this.
   */
  async expectFormReachableWithKeyboardOpen() {
    await this.expectVisible(this.confirmPasswordInput);
    await this.expectVisible(this.submitButton);
  }

  async expectSubmitVisible() {
    await this.expectVisible(this.submitButton);
  }

  /**
   * The view shown once the server has refused the token — the form is gone
   * and only "Return to Login" is on offer.
   */
  async expectRejectedLinkVisible(timeout: number = 20000) {
    await this.waitForElement(this.invalidLinkView, timeout);
  }
}
