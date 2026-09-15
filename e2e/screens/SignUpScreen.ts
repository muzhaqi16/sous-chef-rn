import { BaseScreen } from './BaseScreen';
import { authTestIDs } from '../../src/features/auth/testIDs';
import { kitTestIDs } from '../../src/components/testIDs';

export class SignUpScreen extends BaseScreen {
  protected screenID = authTestIDs.signUpScreen;

  private readonly nameInput = authTestIDs.signUpNameInput;
  private readonly emailInput = authTestIDs.signUpEmailInput;
  private readonly passwordInput = authTestIDs.signUpPasswordInput;
  private readonly confirmPasswordInput =
    authTestIDs.signUpConfirmPasswordInput;

  /** Last field filled here, so it is the one holding the keyboard. */
  protected override keyboardInput = this.confirmPasswordInput;

  /** `AuthFormTemplate`'s title row — above the keyboard on every auth screen. */
  protected override blurTarget = authTestIDs.formTitleRow;
  private readonly submitButton = authTestIDs.signUpSubmitButton;
  private readonly loginLink = authTestIDs.signUpLoginLink;

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
    await this.expectVisible(kitTestIDs.inputError(this.nameInput));
  }

  async expectEmailFieldError() {
    await this.expectVisible(kitTestIDs.inputError(this.emailInput));
  }

  async expectPasswordFieldError() {
    await this.expectVisible(kitTestIDs.inputError(this.passwordInput));
  }

  async expectConfirmPasswordFieldError() {
    await this.expectVisible(kitTestIDs.inputError(this.confirmPasswordInput));
  }

  async expectSubmitVisible() {
    await this.expectVisible(this.submitButton);
  }
}
