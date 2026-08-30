/** The first screen an unauthenticated user sees. */

import { BaseScreen } from './BaseScreen';

export class LandingAuthScreen extends BaseScreen {
  protected screenID = 'landing-auth-screen';

  private readonly loginButton = 'landing-login-button';
  private readonly signupButton = 'landing-signup-button';

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
