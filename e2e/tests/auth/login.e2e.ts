/**
 * Login: happy path, error handling, edge cases.
 *
 * Launches once in `beforeAll`; the Error/Edge/Navigation blocks clear form
 * fields between tests rather than relaunching (~1s vs ~60s).
 */

import { element, by, waitFor } from 'detox';
import { launchAppWithFabricWorkaround } from '../../init';
import { LandingAuthScreen } from '../../screens/LandingAuthScreen';
import { LoginScreen } from '../../screens/LoginScreen';
import { dismissBiometricPromptIfPresent } from '../../helpers/auth';
import { TIMEOUTS, exists, waitForNetworkIdle } from '../../helpers/waitFor';
import { TEST_USER } from '../../fixtures/testData';

describe('Login', () => {
  const landingScreen = new LandingAuthScreen();
  const loginScreen = new LoginScreen();

  // `delete: true` is required — auth tokens persist in MMKV, not the keychain.
  async function launchAndNavigateToLogin() {
    await launchAppWithFabricWorkaround({
      newInstance: true,
      delete: true,
      permissions: { notifications: 'YES' },
    });
    await landingScreen.waitForScreen(10000);
    await landingScreen.tapLogin();
    await loginScreen.waitForScreen(10000);
  }

  async function resetToLoggedOutState() {
    await launchAndNavigateToLogin();
  }

  /**
   * Put the app back on an EMPTY login form. Cheap when already there; a
   * relaunch only when a prior test signed in or navigated away. Without the
   * screen check a drifted test clears nothing and runs against the wrong view.
   */
  async function ensureEmptyLoginForm() {
    if (await exists('login-screen')) {
      await loginScreen.clearForm();
      return;
    }
    await launchAndNavigateToLogin();
  }

  beforeAll(async () => {
    await launchAppWithFabricWorkaround({
      newInstance: true,
      delete: true,
      permissions: { notifications: 'YES' },
    });
  });

  describe('Happy Path', () => {
    beforeEach(async () => {
      try {
        await landingScreen.waitForScreen(3000);
      } catch {
        // Might already be on login screen
      }
    });

    it('should navigate from landing to login screen', async () => {
      await landingScreen.waitForScreen();
      await landingScreen.expectLoginButtonVisible();
      await landingScreen.tapLogin();
      await loginScreen.waitForScreen();
    });

    it('should show all login form elements', async () => {
      await loginScreen.waitForScreen();
      await loginScreen.expectVisible('login-email-input');
      await loginScreen.expectVisible('login-password-input');
      await loginScreen.expectVisible('login-submit-button');
      await loginScreen.expectVisible('login-forgot-password-link');
    });

    it('should login with valid credentials', async () => {
      await loginScreen.waitForScreen();
      await loginScreen.loginAsTestUser();

      await device.takeScreenshot('post-login-submit');

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);
      await dismissBiometricPromptIfPresent();

      await device.takeScreenshot('post-biometric-dismiss');

      // toExist(), not toBeVisible(): FeatureHintOverlay (absoluteFillObject +
      // zIndex 9999) can cover the screen. The screenshot is diagnostic; the
      // rethrow is what lets the test fail.
      try {
        await waitFor(element(by.id('tab-bar')))
          .toExist()
          .withTimeout(20000);
      } catch (error) {
        await device.takeScreenshot('debug-no-main-screen');
        throw error;
      }


      await device.takeScreenshot('after-login');
    });

    it('should persist session across app restart', async () => {
      await device.reloadReactNative();

      await new Promise(resolve => setTimeout(resolve, 2000));

      await device.takeScreenshot('after-reload');


      // A dropped session lands back on landing/login with no tab bar.
      // toExist because the overlay may block visibility.
      try {
        await waitFor(element(by.id('tab-bar')))
          .toExist()
          .withTimeout(15000);
      } catch (error) {
        await device.takeScreenshot('debug-no-tabbar-after-reload');
        throw error;
      }
    });
  });

  describe('Error Cases', () => {
    beforeAll(async () => {
      await resetToLoggedOutState();
    });

    beforeEach(async () => {
      await ensureEmptyLoginForm();
    });

    it('should show error for empty email', async () => {
      await loginScreen.enterPassword('somepassword');

      await loginScreen.submit();
      await device.takeScreenshot('error-empty-email');
      await loginScreen.expectEmailFieldError();
    });

    it('should show error for empty password', async () => {
      await loginScreen.enterEmail(TEST_USER.email);

      await loginScreen.dismissKeyboard('login-email-input');
      await loginScreen.submit();
      await device.takeScreenshot('error-empty-password');
      await loginScreen.expectPasswordFieldError();
    });

    it('should show error for invalid email format', async () => {
      await loginScreen.enterEmail('not-an-email');
      await loginScreen.enterPassword('somepassword');

      await loginScreen.submit();
      await device.takeScreenshot('error-invalid-email');
      await loginScreen.expectEmailFieldError();
    });

    it('should show error for incorrect password', async () => {
      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.enterPassword('wrong_password_123');

      await loginScreen.submit();
      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);
      await device.takeScreenshot('error-incorrect-password');
      await loginScreen.waitForScreen(10000);
      await loginScreen.expectErrorMessage();
    });
  });

  describe('Edge Cases', () => {
    beforeAll(async () => {
      await resetToLoggedOutState();
    });

    beforeEach(async () => {
      await ensureEmptyLoginForm();
    });

    it('should handle special characters in password', async () => {
      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.enterPassword('P@$$w0rd!#$%^&*()');
      await loginScreen.submit();

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

      await device.takeScreenshot('edge-special-chars');

      // Not TEST_USER's password, so the outcome is unambiguous: the server
      // must reject it and the app must stay on the login screen.
      await loginScreen.waitForScreen(TIMEOUTS.DEFAULT);
      await loginScreen.expectErrorMessage();
    });

    it('should handle rapid submit button taps', async () => {
      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.enterPassword(TEST_USER.password);
      await loginScreen.dismissKeyboard();

      // Rapid taps — first tap may log in and remove the button
      const submitButton = element(by.id('login-submit-button'));
      await submitButton.tap();
      try {
        await submitButton.tap();
        await submitButton.tap();
      } catch {
        // Button may have disappeared after first tap (login succeeded)
      }

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);
      await dismissBiometricPromptIfPresent();

      await device.takeScreenshot('edge-rapid-taps');

      // Credentials are valid, so extra taps must not prevent login from
      // completing — one session, no wedged state.
      await waitFor(element(by.id('tab-bar')))
        .toExist()
        .withTimeout(TIMEOUTS.NETWORK);
    });

    it('should clear error when user starts typing', async () => {
      await loginScreen.submit();
      await loginScreen.expectEmailFieldError();
      await device.takeScreenshot('edge-clear-error-before-type');

      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.dismissKeyboard('login-email-input');

      await device.takeScreenshot('edge-clear-error-after-type');
      await loginScreen.expectNoEmailFieldError();
    });
  });

  describe('Navigation', () => {
    beforeAll(async () => {
      await resetToLoggedOutState();
    });

    beforeEach(async () => {
      await ensureEmptyLoginForm();
    });

    it('should navigate to forgot password', async () => {
      await loginScreen.tapForgotPassword();
      await waitFor(element(by.id('forgot-password-screen')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should navigate to sign up', async () => {

      await loginScreen.tapSignUp();

      await device.takeScreenshot('nav-signup');

      // Use toExist() in case an overlay blocks visibility
      await waitFor(element(by.id('signup-screen')))
        .toExist()
        .withTimeout(10000);
    });
  });
});
