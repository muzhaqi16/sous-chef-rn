import { BaseScreen } from './BaseScreen';

export class SignUpScreen extends BaseScreen {
  protected screenID = 'signup-screen';

  private readonly nameInput = 'signup-name-input';
  private readonly emailInput = 'signup-email-input';
  private readonly passwordInput = 'signup-password-input';
  private readonly confirmPasswordInput = 'signup-confirm-password-input';

  /** Last field filled here, so it is the one holding the keyboard. */
  protected keyboardInput = this.confirmPasswordInput;

  /** `AuthFormTemplate`'s title row — above the keyboard on every auth screen. */
  protected blurTarget = 'auth-title-row';
  private readonly submitButton = 'signup-submit-button';
  private readonly loginLink = 'signup-login-link';

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

  async enterName(name: string) {
    await this.clearAndType(this.nameInput, name);
  }

  async enterEmail(email: string) {
    await this.clearAndType(this.emailInput, email);
  }

  async enterPassword(password: string) {
    await this.clearAndType(this.passwordInput, password);
  }

  async enterConfirmPassword(password: string) {
    await this.clearAndType(this.confirmPasswordInput, password);
  }

  async submit() {
    await this.dismissKeyboard();
    await this.tapByID(this.submitButton);
  }

  async navigateToLogin() {
    await this.tapByID(this.loginLink);
  }

  async expectNameFieldError() {
    await this.expectVisible(`${this.nameInput}-error`);
  }

  async expectEmailFieldError() {
    await this.expectVisible(`${this.emailInput}-error`);
  }

  async expectPasswordFieldError() {
    await this.expectVisible(`${this.passwordInput}-error`);
  }

  async expectConfirmPasswordFieldError() {
    await this.expectVisible(`${this.confirmPasswordInput}-error`);
  }

  async expectSubmitVisible() {
    await this.expectVisible(this.submitButton);
  }
}
