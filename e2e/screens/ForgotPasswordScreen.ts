/**
 * ForgotPasswordScreen
 *
 * Screen object model for the Forgot Password screen.
 * Provides methods for interacting with password reset functionality.
 */

import { BaseScreen } from './BaseScreen';

export class ForgotPasswordScreen extends BaseScreen {
  protected screenID = 'forgot-password-screen';

  // Element IDs
  private readonly emailInput = 'forgot-password-email-input';
  private readonly submitButton = 'forgot-password-submit-button';
  private readonly loginLink = 'forgot-password-login-link';

  /**
   * Request password reset for email
   */
  async requestPasswordReset(email: string) {
    await this.waitForScreen();
    await this.clearAndType(this.emailInput, email);
    await this.dismissKeyboard();
    await this.tapByID(this.submitButton);
  }

  /**
   * Enter email
   */
  async enterEmail(email: string) {
    await this.clearAndType(this.emailInput, email);
  }

  /**
   * Tap submit button
   */
  async submit() {
    await this.dismissKeyboard();
    await this.tapByID(this.submitButton);
  }

  /**
   * Navigate to login screen
   */
  async navigateToLogin() {
    await this.tapByID(this.loginLink);
  }

  /**
   * Check if email field has error
   */
  async expectEmailFieldError() {
    await this.expectVisible(`${this.emailInput}-error`);
  }

  /**
   * Expect submit button to be visible
   */
  async expectSubmitVisible() {
    await this.expectVisible(this.submitButton);
  }

  /**
   * Expect success message
   */
  async expectSuccessMessage() {
    await this.expectTextVisible('reset link');
  }
}
