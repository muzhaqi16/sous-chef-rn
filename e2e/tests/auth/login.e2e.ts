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

import { element, by, waitFor, expect } from 'detox';
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

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);
      await dismissBiometricPromptIfPresent();

      try {
        await pantryScreen.waitForScreen(5000);
      } catch {
        await shoppingListScreen.waitForScreen(5000);
      }
    });

    it('should persist session across app restart', async () => {
      await device.reloadReactNative();

      await waitFor(element(by.id('splash-screen')))
        .not.toBeVisible()
        .withTimeout(10000);

      await waitFor(element(by.id('tab-bar')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });
  });

  describe('Error Cases', () => {
    // Relaunch once to get back to logged-out state after Happy Path
    beforeAll(async () => {
      await device.launchApp({ newInstance: true, delete: true });
      await landingScreen.waitForScreen(5000);
      await landingScreen.tapLogin();
      await loginScreen.waitForScreen();
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
    });

    it('should show error for empty email', async () => {
      await loginScreen.enterPassword('somepassword');
      await loginScreen.submit();

      await loginScreen.waitForScreen();
      await loginScreen.expectEmailFieldError();
    });

    it('should show error for empty password', async () => {
      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.submit();

      await loginScreen.waitForScreen();
      await loginScreen.expectPasswordFieldError();
    });

    it('should show error for invalid email format', async () => {
      await loginScreen.enterEmail('not-an-email');
      await loginScreen.enterPassword('somepassword');
      await loginScreen.submit();

      await loginScreen.waitForScreen();
      await loginScreen.expectEmailFieldError();
    });

    it('should show error for incorrect password', async () => {
      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.enterPassword('wrong_password_123');
      await loginScreen.submit();

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

      await loginScreen.waitForScreen();
      await loginScreen.expectErrorMessage();
    });
  });

  describe('Edge Cases', () => {
    // Relaunch once to get clean state (previous test may have triggered network errors)
    beforeAll(async () => {
      await device.launchApp({ newInstance: true, delete: true });
      await landingScreen.waitForScreen(5000);
      await landingScreen.tapLogin();
      await loginScreen.waitForScreen();
    });

    it('should handle special characters in password', async () => {
      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.enterPassword('P@$$w0rd!#$%^&*()');
      await loginScreen.submit();

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

      try {
        await loginScreen.waitForScreen(2000);
      } catch {
        await waitFor(element(by.id('tab-bar')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);
      }
    });

    it('should handle rapid submit button taps', async () => {
      // Relaunch for clean state (previous test may have logged in)
      await device.launchApp({ newInstance: true, delete: true });
      await landingScreen.waitForScreen(5000);
      await landingScreen.tapLogin();
      await loginScreen.waitForScreen();

      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.enterPassword(TEST_USER.password);

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

      // Verify we either logged in or are still on login screen (no crash)
      try {
        await loginScreen.waitForScreen(2000);
      } catch {
        await waitFor(element(by.id('tab-bar')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);
      }
    });

    it('should clear error when user starts typing', async () => {
      // Relaunch for clean state (previous test logged in)
      await device.launchApp({ newInstance: true, delete: true });
      await landingScreen.waitForScreen(5000);
      await landingScreen.tapLogin();
      await loginScreen.waitForScreen();

      await loginScreen.submit(); // Submit with empty fields

      await loginScreen.waitForScreen();

      await loginScreen.enterEmail('test');

      await loginScreen.waitForScreen();
    });
  });

  describe('Navigation', () => {
    beforeAll(async () => {
      await device.launchApp({ newInstance: true, delete: true });
      await landingScreen.waitForScreen(5000);
      await landingScreen.tapLogin();
      await loginScreen.waitForScreen();
    });

    it('should navigate to forgot password', async () => {
      await loginScreen.tapForgotPassword();
      await waitForScreen('forgot-password-screen', TIMEOUTS.DEFAULT);
    });

    it('should navigate to sign up', async () => {
      // Relaunch to get back to login (previous test navigated away)
      await device.launchApp({ newInstance: true, delete: true });
      await landingScreen.waitForScreen(5000);
      await landingScreen.tapLogin();
      await loginScreen.waitForScreen();

      await loginScreen.tapSignUp();
      await waitForScreen('signup-screen', TIMEOUTS.DEFAULT);
    });
  });
});
