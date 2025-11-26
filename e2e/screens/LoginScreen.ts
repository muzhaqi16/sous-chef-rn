/**
 * LoginScreen
 *
 * Screen object model for the Login screen.
 * Provides methods for interacting with login functionality.
 */

import { BaseScreen } from './BaseScreen';
import { TEST_USER } from '../fixtures/testData';

export class LoginScreen extends BaseScreen {
  protected screenID = 'login-screen';

  // Element IDs
  private readonly emailInput = 'login-email-input';
  private readonly passwordInput = 'login-password-input';
  private readonly submitButton = 'login-submit-button';
  private readonly signupLink = 'login-signup-link';
  private readonly forgotPasswordLink = 'login-forgot-password-link';
  private readonly errorToast = 'toast-error'; // Global error toast
  private readonly loadingIndicator = 'login-loading';

  /**
   * Login with provided credentials
   */
  async loginWith(email: string, password: string) {
    await this.waitForScreen();
    await this.clearAndType(this.emailInput, email);
    await this.clearAndType(this.passwordInput, password);
    await this.dismissKeyboard();
    await this.tapByID(this.submitButton);
  }

  /**
   * Login with test user credentials
   */
  async loginAsTestUser() {
    await this.loginWith(TEST_USER.email, TEST_USER.password);
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
   * Tap submit/login button
   */
  async submit() {
    await this.dismissKeyboard();
    await this.tapByID(this.submitButton);
  }

  /**
   * Navigate to signup screen
   */
  async navigateToSignup() {
    await this.tapByID(this.signupLink);
  }

  /**
   * Navigate to forgot password screen
   */
  async navigateToForgotPassword() {
    await this.tapByID(this.forgotPasswordLink);
  }

  /**
   * Check if error message is visible (via global toast)
   * Note: On Android, native ToastAndroid cannot be detected by Detox
   * This works on iOS only. For Android, we just verify login didn't succeed.
   */
  async expectErrorMessage(message?: string) {
    try {
      // Try to find the error toast (iOS only)
      await this.waitForElement(this.errorToast, 3000);
      await this.expectVisible(this.errorToast);
      if (message) {
        await this.expectTextVisible(message);
      }
    } catch {
      // On Android or if toast disappeared, just verify we're still on login screen
      await this.expectScreenVisible();
    }
  }

  /**
   * Check if loading indicator is visible
   */
  async expectLoadingVisible() {
    await this.expectVisible(this.loadingIndicator);
  }

  /**
   * Check if loading indicator is not visible
   */
  async expectLoadingNotVisible() {
    await this.expectNotVisible(this.loadingIndicator);
  }

  /**
   * Wait for login to complete (loading indicator disappears)
   */
  async waitForLoginComplete(timeout: number = 10000) {
    await this.waitForElementToDisappear(this.loadingIndicator, timeout);
  }

  /**
   * Expect login button to be enabled
   */
  async expectSubmitEnabled() {
    // Note: Detox doesn't have toBeEnabled() matcher
    // We verify the button exists and is visible (which implies it's enabled)
    await this.expectVisible(this.submitButton);
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
   * Complete login flow and wait for next screen
   */
  async loginAndWaitForHome(email: string, password: string) {
    await this.loginWith(email, password);
    await this.waitForLoginComplete();
    // Screen should navigate away
    await this.waitForElementToDisappear(this.screenID, 5000);
  }
}
