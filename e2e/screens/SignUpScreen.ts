/**
 * SignUpScreen
 *
 * Screen object model for the Sign Up screen.
 * Provides methods for interacting with registration functionality.
 */

import { BaseScreen } from './BaseScreen';

export class SignUpScreen extends BaseScreen {
  protected screenID = 'signup-screen';

  // Element IDs
  private readonly nameInput = 'signup-name-input';
  private readonly emailInput = 'signup-email-input';
  private readonly passwordInput = 'signup-password-input';
  private readonly confirmPasswordInput = 'signup-confirm-password-input';
  private readonly submitButton = 'signup-submit-button';
  private readonly loginLink = 'signup-login-link';

  /**
   * Sign up with provided credentials
   */
  async signUpWith(
    name: string,
    email: string,
    password: string,
    confirmPassword?: string,
  ) {
    await this.waitForScreen();
    await this.clearAndType(this.nameInput, name);
    await this.clearAndType(this.emailInput, email);
    await this.clearAndType(this.passwordInput, password);
    await this.clearAndType(
      this.confirmPasswordInput,
      confirmPassword || password,
    );
    await this.dismissKeyboard();
    await this.tapByID(this.submitButton);
  }

  /**
   * Enter name
   */
  async enterName(name: string) {
    await this.clearAndType(this.nameInput, name);
  }

  /**
   * Enter email
   */
  async enterEmail(email: string) {
    await this.clearAndType(this.emailInput, email);
  }

  /**
   * Enter password
   */
  async enterPassword(password: string) {
    await this.clearAndType(this.passwordInput, password);
  }

  /**
   * Enter confirm password
   */
  async enterConfirmPassword(password: string) {
    await this.clearAndType(this.confirmPasswordInput, password);
  }

  /**
   * Tap submit/signup button
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
   * Check if name field has error
   */
  async expectNameFieldError() {
    await this.expectVisible(`${this.nameInput}-error`);
  }

  /**
   * Check if email field has error
   */
  async expectEmailFieldError() {
    await this.expectVisible(`${this.emailInput}-error`);
  }

  /**
   * Check if password field has error
   */
  async expectPasswordFieldError() {
    await this.expectVisible(`${this.passwordInput}-error`);
  }

  /**
   * Check if confirm password field has error
   */
  async expectConfirmPasswordFieldError() {
    await this.expectVisible(`${this.confirmPasswordInput}-error`);
  }

  /**
   * Expect submit button to be visible
   */
  async expectSubmitVisible() {
    await this.expectVisible(this.submitButton);
  }
}
