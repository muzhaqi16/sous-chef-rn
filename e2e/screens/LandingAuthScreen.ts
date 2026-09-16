/** The first screen an unauthenticated user sees. */

import { BaseScreen } from './BaseScreen';
import { authTestIDs } from '../../src/features/auth/testIDs';

export class LandingAuthScreen extends BaseScreen {
  protected screenID = authTestIDs.landingScreen;

  private readonly loginButton = authTestIDs.landingLoginButton;
  private readonly signupButton = authTestIDs.landingSignUpButton;

  async tapLogin() {
    await this.tapByID(this.loginButton);
  }

  async tapSignup() {
    await this.tapByID(this.signupButton);
  }

  /** Alias for {@link tapSignup}. */
  async tapSignUp() {
    await this.tapSignup();
  }

  async expectLoginButtonVisible() {
    await this.expectVisible(this.loginButton);
  }

  async expectSignupButtonVisible() {
    await this.expectVisible(this.signupButton);
  }
}
