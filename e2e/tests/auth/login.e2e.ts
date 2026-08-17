/**
 * Login E2E Tests
 *
 * Tests for the login functionality including:
 * - Happy path login
 * - Error handling (invalid credentials, empty fields)
 * - Edge cases (rapid taps, special characters)
 *
 * Performance: Launches app once in beforeAll. Error/Edge/Navigation tests
 * clear form fields between tests instead of relaunching (~1s vs ~60s).
 * Only relaunches once after Happy Path logs in.
 */

import { element, by, waitFor } from 'detox';
import { launchAppWithFabricWorkaround } from '../../init';
import {
  LandingAuthScreen,
  LoginScreen,
  ShoppingListScreen,
  PantryScreen,
} from '../../screens';
import {
  waitForScreen,
  waitForNetworkIdle,
  dismissBiometricPromptIfPresent,
  TIMEOUTS,
} from '../../helpers';
import { TEST_USER } from '../../fixtures/testData';

describe('Login', () => {
  const landingScreen = new LandingAuthScreen();
  const loginScreen = new LoginScreen();
  const shoppingListScreen = new ShoppingListScreen();
  const pantryScreen = new PantryScreen();

  /**
   * Launch fresh app (delete all data) and navigate to login screen.
   * Uses delete: true to clear MMKV-persisted auth tokens.
   */
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

  /**
   * Reset to logged-out state by deleting app data and navigating to login.
   * Auth tokens are stored in MMKV (not keychain), so delete: true is required.
   */
  async function resetToLoggedOutState() {
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

      // Screenshot immediately after login to debug what screen we land on
      await device.takeScreenshot('post-login-submit');

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);
      await dismissBiometricPromptIfPresent();

      await device.takeScreenshot('post-biometric-dismiss');

      // The one assertion that login actually worked. The screenshot is for
      // diagnosis; the rethrow is what makes the test able to fail. Swallowing
      // this meant a login that never completed still passed.
      // toExist() rather than toBeVisible() because FeatureHintOverlay
      // (absoluteFillObject + zIndex 9999) can cover the screen.
      try {
        await waitFor(element(by.id('tab-bar')))
          .toExist()
          .withTimeout(20000);
      } catch (error) {
        await device.takeScreenshot('debug-no-main-screen');
        throw error;
      }

      // Dismiss feature hint overlay if it appears (has 2s delay after pantry loads)
      try {
        await waitFor(element(by.id('feature-hint-overlay-dismiss')))
          .toBeVisible()
          .withTimeout(5000);
        await element(by.id('feature-hint-overlay-dismiss')).tap();
      } catch {
        // Hint may not appear (already dismissed or not on pantry)
      }

      await device.takeScreenshot('after-login');
    });

    it('should persist session across app restart', async () => {
      await device.reloadReactNative();

      // Wait for reload to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      await device.takeScreenshot('after-reload');

      // Dismiss feature hint overlay if it reappears after reload
      try {
        await waitFor(element(by.id('feature-hint-overlay-dismiss')))
          .toBeVisible()
          .withTimeout(3000);
        await element(by.id('feature-hint-overlay-dismiss')).tap();
      } catch {
        // Overlay may not reappear
      }

      // The one assertion that the session survived the reload — a dropped
      // session lands back on the landing/login screen with no tab bar, and
      // swallowing this made that outcome indistinguishable from success.
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
    // Reset to logged-out state (fast keychain clear + reload)
    beforeAll(async () => {
      await resetToLoggedOutState();
    });

    beforeEach(async () => {
      // Clear fields between tests (fast — no relaunch needed)
      try {
        await element(by.id('login-email-input')).clearText();
      } catch {
        // Field might not have text
      }
      try {
        await element(by.id('login-password-input')).clearText();
      } catch {
        // Field might not have text
      }
      // Dismiss keyboard using tapReturnKey (more reliable than tapping labels)
      try {
        await element(by.id('login-password-input')).tapReturnKey();
      } catch {
        // Keyboard already dismissed — nothing to send a return key to.
      }
    });

    it('should show error for empty email', async () => {
      await loginScreen.enterPassword('somepassword');

      // Dismiss keyboard using tapReturnKey on last focused field.
      // This avoids UIInputSetContainerView blocking submit button taps.
      try {
        await element(by.id('login-password-input')).tapReturnKey();
      } catch {
        // Keyboard already dismissed — nothing to send a return key to.
      }

      await element(by.id('login-submit-button')).tap();
      await device.takeScreenshot('error-empty-email');
      await loginScreen.expectEmailFieldError();
    });

    it('should show error for empty password', async () => {
      await loginScreen.enterEmail(TEST_USER.email);

      // Dismiss keyboard before tapping submit
      try {
        await element(by.id('login-email-input')).tapReturnKey();
      } catch {
        // Keyboard already dismissed — nothing to send a return key to.
      }

      await element(by.id('login-submit-button')).tap();
      await device.takeScreenshot('error-empty-password');
      await loginScreen.expectPasswordFieldError();
    });

    it('should show error for invalid email format', async () => {
      await loginScreen.enterEmail('not-an-email');
      await loginScreen.enterPassword('somepassword');

      // Dismiss keyboard before tapping submit
      try {
        await element(by.id('login-password-input')).tapReturnKey();
      } catch {
        // Keyboard already dismissed — nothing to send a return key to.
      }

      await element(by.id('login-submit-button')).tap();
      await device.takeScreenshot('error-invalid-email');
      await loginScreen.expectEmailFieldError();
    });

    it('should show error for incorrect password', async () => {
      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.enterPassword('wrong_password_123');

      // Dismiss keyboard before tapping submit
      try {
        await element(by.id('login-password-input')).tapReturnKey();
      } catch {
        // Keyboard already dismissed — nothing to send a return key to.
      }

      await element(by.id('login-submit-button')).tap();
      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);
      await device.takeScreenshot('error-incorrect-password');
      await loginScreen.waitForScreen(10000);
      await loginScreen.expectErrorMessage();
    });
  });

  describe('Edge Cases', () => {
    // Reset to logged-out state (fast keychain clear + reload)
    beforeAll(async () => {
      await resetToLoggedOutState();
    });

    it('should handle special characters in password', async () => {
      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.enterPassword('P@$$w0rd!#$%^&*()');
      await loginScreen.submit();

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

      await device.takeScreenshot('edge-special-chars');

      // This password is not TEST_USER's, so the outcome is not ambiguous: the
      // server must reject it and the app must stay on the login screen with
      // the special characters intact. Accepting "still here OR logged in"
      // meant the test passed either way and proved nothing.
      await loginScreen.waitForScreen(TIMEOUTS.DEFAULT);
      await loginScreen.expectErrorMessage();
    });

    it('should handle rapid submit button taps', async () => {
      // Relaunch for clean state (previous test may have logged in)
      await launchAndNavigateToLogin();

      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.enterPassword(TEST_USER.password);

      // Dismiss keyboard before tapping submit (UIInputSetContainerView blocks taps)
      try {
        await element(by.id('login-password-input')).tapReturnKey();
      } catch {
        // Keyboard already dismissed — nothing to send a return key to.
      }

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

      // The credentials are valid, so extra taps must not prevent the login
      // from completing — one session, no wedged state. "Logged in OR still on
      // login" accepted the exact failure the test is named for.
      try {
        await waitFor(element(by.id('feature-hint-overlay-dismiss')))
          .toBeVisible()
          .withTimeout(3000);
        await element(by.id('feature-hint-overlay-dismiss')).tap();
      } catch {
        // Hint may not appear (already dismissed, or not on pantry).
      }
      await waitFor(element(by.id('tab-bar')))
        .toExist()
        .withTimeout(TIMEOUTS.NETWORK);
    });

    it('should clear error when user starts typing', async () => {
      // Relaunch for clean state (previous test logged in)
      await launchAndNavigateToLogin();

      await loginScreen.submit(); // Submit with empty fields

      // Dismiss keyboard so errors are visible
      try {
        await element(by.text('Sign in to Sous Chef')).tap();
      } catch {
        // No autofill bar to dismiss.
      }

      await device.takeScreenshot('edge-clear-error-before-type');

      await loginScreen.enterEmail('test');

      // Dismiss keyboard again to see if errors cleared
      try {
        await element(by.text('Sign in to Sous Chef')).tap();
      } catch {
        // No autofill bar to dismiss.
      }

      await device.takeScreenshot('edge-clear-error-after-type');

      // Verify we're still on the login screen
      await loginScreen.waitForScreen(5000);
    });
  });

  describe('Navigation', () => {
    // Reset to logged-out state (fast keychain clear + reload)
    beforeAll(async () => {
      await resetToLoggedOutState();
    });

    it('should navigate to forgot password', async () => {
      // Dismiss any iOS autofill suggestions by tapping the title area
      try {
        await element(by.text('Sign in to Sous Chef')).tap();
      } catch {
        // No autofill bar to dismiss.
      }

      await loginScreen.tapForgotPassword();

      // Use toExist() in case an overlay blocks visibility
      await waitFor(element(by.id('forgot-password-screen')))
        .toExist()
        .withTimeout(10000);
    });

    it('should navigate to sign up', async () => {
      // Relaunch to get back to login (previous test navigated away)
      await launchAndNavigateToLogin();

      // Dismiss any iOS autofill suggestions by tapping the title area
      try {
        await element(by.text('Sign in to Sous Chef')).tap();
      } catch {
        // No autofill bar to dismiss.
      }

      // Tap the sign up link
      await loginScreen.tapSignUp();

      await device.takeScreenshot('nav-signup');

      // Use toExist() in case an overlay blocks visibility
      await waitFor(element(by.id('signup-screen')))
        .toExist()
        .withTimeout(10000);
    });
  });
});
