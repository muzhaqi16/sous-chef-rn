/**
 * The screen where a user chooses a new password. Reached by deep link
 * (`souschef://reset-password?token=…`), not by in-app navigation.
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
   * Drops the keyboard first: Detox taps an element's CENTRE, and with the
   * keyboard up the button's centre can sit behind it — the tap lands on a key
   * and a "nothing happened" assertion passes without a press. Reachability
   * with the keyboard up is {@link expectFormReachableWithKeyboardOpen}.
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
   * Detox reports a view visible only when it is actually unobscured, so a
   * keyboard sitting over the confirm field or Submit fails this.
   */
  async expectFormReachableWithKeyboardOpen() {
    await this.expectVisible(this.confirmPasswordInput);
    await this.expectVisible(this.submitButton);
  }

  async expectSubmitVisible() {
    await this.expectVisible(this.submitButton);
  }

  /** Shown once the server refuses the token: the form is gone, only "Return to Login". */
  async expectRejectedLinkVisible(timeout: number = 20000) {
    await this.waitForElement(this.invalidLinkView, timeout);
  }
}
