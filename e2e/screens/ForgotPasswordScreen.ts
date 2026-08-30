import { BaseScreen } from './BaseScreen';

export class ForgotPasswordScreen extends BaseScreen {
  protected screenID = 'forgot-password-screen';

  private readonly emailInput = 'forgot-password-email-input';
  private readonly submitButton = 'forgot-password-submit-button';
  private readonly loginLink = 'forgot-password-login-link';
  private readonly sentView = 'forgot-password-sent';

  async requestPasswordReset(email: string) {
    await this.waitForScreen();
    await this.clearAndType(this.emailInput, email);
    await this.dismissKeyboard();
    await this.tapByID(this.submitButton);
  }

  async enterEmail(email: string) {
    await this.clearAndType(this.emailInput, email);
  }

  async submit() {
    await this.dismissKeyboard();
    await this.tapByID(this.submitButton);
  }

  async navigateToLogin() {
    await this.tapByID(this.loginLink);
  }

  async expectEmailFieldError() {
    await this.expectVisible(`${this.emailInput}-error`);
  }

  async expectSubmitVisible() {
    await this.expectVisible(this.submitButton);
  }

  /**
   * The sent-confirmation view. Asserted by testID, not by copy: the screen
   * renders `resetLinkSentTitle` + prefix/suffix, and `by.text` is exact, so
   * no substring of that copy can be matched.
   */
  async expectSuccessMessage() {
    await this.expectVisible(this.sentView);
  }
}
