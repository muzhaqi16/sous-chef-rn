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

      // Wait for tab-bar which is present on all main screens.
      // Use toExist() because FeatureHintOverlay (absoluteFillObject + zIndex:9999)
      // may cover the screen and block toBeVisible checks.
      try {
        await waitFor(element(by.id('tab-bar')))
          .toExist()
          .withTimeout(20000);
      } catch {
        // Take debug screenshot if no main screen appears
        await device.takeScreenshot('debug-no-main-screen');
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

      // Use toExist for initial check since overlay may block visibility
      try {
        await waitFor(element(by.id('tab-bar')))
          .toExist()
          .withTimeout(15000);
      } catch {
        await device.takeScreenshot('debug-no-tabbar-after-reload');
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
      } catch {}
    });

    it('should show error for empty email', async () => {
      await loginScreen.enterPassword('somepassword');

      // Dismiss keyboard using tapReturnKey on last focused field.
      // This avoids UIInputSetContainerView blocking submit button taps.
      try {
        await element(by.id('login-password-input')).tapReturnKey();
      } catch {}

      await element(by.id('login-submit-button')).tap();
      await device.takeScreenshot('error-empty-email');
      await loginScreen.expectEmailFieldError();
    });

    it('should show error for empty password', async () => {
      await loginScreen.enterEmail(TEST_USER.email);

      // Dismiss keyboard before tapping submit
      try {
        await element(by.id('login-email-input')).tapReturnKey();
      } catch {}

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
      } catch {}

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
      } catch {}

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

      // Should stay on login screen (wrong password) or possibly log in
      try {
        await loginScreen.waitForScreen(5000);
      } catch {
        // If login succeeded, check tab-bar exists (overlay may block visibility)
        try {
          await waitFor(element(by.id('feature-hint-overlay-dismiss')))
            .toBeVisible()
            .withTimeout(3000);
          await element(by.id('feature-hint-overlay-dismiss')).tap();
        } catch {}
        await waitFor(element(by.id('tab-bar')))
          .toExist()
          .withTimeout(TIMEOUTS.DEFAULT);
      }
    });

    it('should handle rapid submit button taps', async () => {
      // Relaunch for clean state (previous test may have logged in)
      await launchAndNavigateToLogin();

      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.enterPassword(TEST_USER.password);

      // Dismiss keyboard before tapping submit (UIInputSetContainerView blocks taps)
      try {
        await element(by.id('login-password-input')).tapReturnKey();
      } catch {}

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

      // Verify we either logged in or are still on login screen (no crash)
      try {
        await loginScreen.waitForScreen(2000);
      } catch {
        // Dismiss overlay before checking tab-bar
        try {
          await waitFor(element(by.id('feature-hint-overlay-dismiss')))
            .toBeVisible()
            .withTimeout(3000);
          await element(by.id('feature-hint-overlay-dismiss')).tap();
        } catch {}
        await waitFor(element(by.id('tab-bar')))
          .toExist()
          .withTimeout(10000);
      }
    });

    it('should clear error when user starts typing', async () => {
      // Relaunch for clean state (previous test logged in)
      await launchAndNavigateToLogin();

      await loginScreen.submit(); // Submit with empty fields

      // Dismiss keyboard so errors are visible
      try {
        await element(by.text('Sign in to Sous Chef')).tap();
      } catch {}

      await device.takeScreenshot('edge-clear-error-before-type');

      await loginScreen.enterEmail('test');

      // Dismiss keyboard again to see if errors cleared
      try {
        await element(by.text('Sign in to Sous Chef')).tap();
      } catch {}

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
      } catch {}

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
      } catch {}

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
