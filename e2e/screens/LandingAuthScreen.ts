/**
 * LandingAuthScreen
 *
 * Screen object model for the Landing/Welcome auth screen.
 * This is the first screen shown to unauthenticated users.
 */

import { BaseScreen } from './BaseScreen';

export class LandingAuthScreen extends BaseScreen {
  protected screenID = 'landing-auth-screen';

  // Element IDs
  private readonly loginButton = 'landing-login-button';
  private readonly signupButton = 'landing-signup-button';

  /**
   * Tap the "Log In" button to navigate to login form
   */
  async tapLogin() {
    await this.tapByID(this.loginButton);
  }

  /**
   * Tap the "Sign Up" button to navigate to signup form
   */
  async tapSignup() {
    await this.tapByID(this.signupButton);
  }

  /**
   * Tap the "Sign Up" button (alias with camelCase)
   */
  async tapSignUp() {
    await this.tapSignup();
  }

  /**
   * Expect login button to be visible
   */
  async expectLoginButtonVisible() {
    await this.expectVisible(this.loginButton);
  }

  /**
   * Expect signup button to be visible
   */
  async expectSignupButtonVisible() {
    await this.expectVisible(this.signupButton);
  }
}
