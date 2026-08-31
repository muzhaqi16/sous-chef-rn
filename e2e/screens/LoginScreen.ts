import { BaseScreen } from './BaseScreen';
import { TEST_USER } from '../fixtures/testData';

export class LoginScreen extends BaseScreen {
  protected screenID = 'login-screen';

  private readonly emailInput = 'login-email-input';
  private readonly passwordInput = 'login-password-input';

  /** Last field filled here, so it is the one holding the keyboard. */
  protected keyboardInput = this.passwordInput;

  /** `AuthFormTemplate`'s title row — above the keyboard on every auth screen. */
  protected blurTarget = 'auth-title-row';
  private readonly submitButton = 'login-submit-button';
  private readonly signupLink = 'login-signup-link';
  private readonly forgotPasswordLink = 'login-forgot-password-link';
  private readonly errorToast = 'toast-error'; // Global error toast
  private readonly loadingIndicator = 'login-loading';

  async loginWith(email: string, password: string) {
    await this.waitForScreen();
    await this.clearAndType(this.emailInput, email);
    await this.clearAndType(this.passwordInput, password);
    await this.dismissKeyboard();
    await this.tapByID(this.submitButton);
  }

  async loginAsTestUser() {
    await this.loginWith(TEST_USER.email, TEST_USER.password);
  }

  /** Empty both fields and drop the keyboard, so a test can reuse the screen. */
  async clearForm() {
    for (const id of [this.emailInput, this.passwordInput]) {
      try {
        await this.getElementById(id).clearText();
      } catch {
        // Already empty.
      }
    }
    await this.dismissKeyboard();
  }

  async enterEmail(email: string) {
    await this.clearAndType(this.emailInput, email);
  }

  async enterPassword(password: string) {
    await this.clearAndType(this.passwordInput, password);
  }

  async submit() {
    await this.dismissKeyboard();
    await this.tapPastKeyboard(this.submitButton);
  }

  async navigateToSignup() {
    await this.tapByID(this.signupLink);
  }

  /** Alias for {@link navigateToSignup}. */
  async tapSignUp() {
    await this.navigateToSignup();
  }

  async navigateToForgotPassword() {
    await this.tapByID(this.forgotPasswordLink);
  }

  /** Alias for {@link navigateToForgotPassword}. */
  async tapForgotPassword() {
    await this.navigateToForgotPassword();
  }

  /**
   * Detox cannot see Android's native ToastAndroid, so the toast assertion is
   * iOS-only; elsewhere this falls back to "still on the login screen".
   */
  async expectErrorMessage(message?: string) {
    try {
      await this.waitForElement(this.errorToast, 3000);
      await this.expectVisible(this.errorToast);
      if (message) {
        await this.expectTextVisible(message);
      }
    } catch {
      await this.expectScreenVisible();
    }
  }

  async expectLoadingVisible() {
    await this.expectVisible(this.loadingIndicator);
  }

  async expectLoadingNotVisible() {
    await this.expectNotVisible(this.loadingIndicator);
  }

  async waitForLoginComplete(timeout: number = 10000) {
    await this.waitForElementToDisappear(this.loadingIndicator, timeout);
  }

  /** Detox has no `toBeEnabled()` matcher; visibility is the closest proxy. */
  async expectSubmitEnabled() {
    await this.expectVisible(this.submitButton);
  }

  async expectEmailFieldError() {
    await this.expectVisible(`${this.emailInput}-error`);
  }

  async expectNoEmailFieldError() {
    await this.expectNotVisible(`${this.emailInput}-error`);
  }

  async expectPasswordFieldError() {
    await this.expectVisible(`${this.passwordInput}-error`);
  }

  async loginAndWaitForHome(email: string, password: string) {
    await this.loginWith(email, password);
    await this.waitForLoginComplete();
    await this.waitForElementToDisappear(this.screenID, 5000);
  }
}
