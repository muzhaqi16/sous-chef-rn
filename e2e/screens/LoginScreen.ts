import { BaseScreen } from './BaseScreen';
import { TEST_USER } from '../fixtures/testData';
import { authTestIDs } from '../../src/features/auth/testIDs';
import { kitTestIDs } from '../../src/components/testIDs';

export class LoginScreen extends BaseScreen {
  protected screenID = authTestIDs.loginScreen;

  private readonly emailInput = authTestIDs.loginEmailInput;
  private readonly passwordInput = authTestIDs.loginPasswordInput;

  /** Last field filled here, so it is the one holding the keyboard. */
  protected override keyboardInput = this.passwordInput;

  /** `AuthFormTemplate`'s title row — above the keyboard on every auth screen. */
  protected override blurTarget = authTestIDs.formTitleRow;
  private readonly submitButton = authTestIDs.loginSubmitButton;
  private readonly signupLink = authTestIDs.loginSignUpLink;
  private readonly forgotPasswordLink = authTestIDs.loginForgotPasswordLink;
  private readonly errorToast = kitTestIDs.toast('error');

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
  async expectErrorMessage() {
    try {
      await this.waitForElement(this.errorToast, 3000);
      await this.expectVisible(this.errorToast);
    } catch {
      await this.expectScreenVisible();
    }
  }

  /** Detox has no `toBeEnabled()` matcher; visibility is the closest proxy. */
  async expectSubmitEnabled() {
    await this.expectVisible(this.submitButton);
  }

  async expectEmailFieldError() {
    await this.expectVisible(kitTestIDs.inputError(this.emailInput));
  }

  async expectNoEmailFieldError() {
    await this.expectNotVisible(kitTestIDs.inputError(this.emailInput));
  }

  async expectPasswordFieldError() {
    await this.expectVisible(kitTestIDs.inputError(this.passwordInput));
  }
}
