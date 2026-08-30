import { BaseScreen } from './BaseScreen';

export class ForgotPasswordScreen extends BaseScreen {
  protected screenID = 'forgot-password-screen';

  private readonly emailInput = 'forgot-password-email-input';
  private readonly submitButton = 'forgot-password-submit-button';
  private readonly loginLink = 'forgot-password-login-link';

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

  async expectSuccessMessage() {
    await this.expectTextVisible('reset link');
  }
}
