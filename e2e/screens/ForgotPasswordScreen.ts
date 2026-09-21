import { BaseScreen } from './BaseScreen';
import { authTestIDs } from '../../src/features/auth/testIDs';
import { kitTestIDs } from '../../src/components/testIDs';

export class ForgotPasswordScreen extends BaseScreen {
  protected screenID = authTestIDs.forgotPasswordScreen;

  private readonly emailInput = authTestIDs.forgotPasswordEmailInput;

  /** Last field filled here, so it is the one holding the keyboard. */
  protected override keyboardInput = this.emailInput;

  /** `AuthFormTemplate`'s title row — above the keyboard on every auth screen. */
  protected override blurTarget = authTestIDs.formTitleRow;
  private readonly submitButton = authTestIDs.forgotPasswordSubmitButton;
  private readonly loginLink = authTestIDs.forgotPasswordLoginLink;
  private readonly sentView = authTestIDs.forgotPasswordSentView;

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
    await this.expectVisible(kitTestIDs.inputError(this.emailInput));
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
