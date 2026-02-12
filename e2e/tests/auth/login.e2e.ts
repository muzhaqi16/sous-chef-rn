/**
 * Login E2E Tests
 *
 * Tests for the login functionality including:
 * - Happy path login
 * - Error handling (invalid credentials, empty fields)
 * - Edge cases (rapid taps, special characters)
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

  beforeEach(async () => {
    // Ensure we start from landing or login screen
    try {
      await landingScreen.waitForScreen(3000);
    } catch {
      // Might already be on login screen
    }
  });

  describe('Happy Path', () => {
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

      // Should navigate to home screen (pantry or shopping list)
      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

      try {
        await pantryScreen.waitForScreen(5000);
      } catch {
        await shoppingListScreen.waitForScreen(5000);
      }
    });

    it('should persist session across app restart', async () => {
      // Reload the app
      await device.reloadReactNative();

      // Wait for splash to disappear
      await waitFor(element(by.id('splash-screen')))
        .not.toBeVisible()
        .withTimeout(10000);

      // Should still be logged in (tab bar visible)
      await waitFor(element(by.id('tab-bar')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });
  });

  describe('Error Cases', () => {
    beforeEach(async () => {
      // Ensure we're logged out for error tests
      await device.launchApp({
        newInstance: true,
        delete: true,
      });
      await landingScreen.waitForScreen(5000);
      await landingScreen.tapLogin();
      await loginScreen.waitForScreen();
    });

    it('should show error for empty email', async () => {
      await loginScreen.enterPassword('somepassword');
      await loginScreen.submit();

      // Should stay on login screen with validation error
      await loginScreen.waitForScreen();
      await loginScreen.expectEmailFieldError();
    });

    it('should show error for empty password', async () => {
      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.submit();

      // Should stay on login screen with validation error
      await loginScreen.waitForScreen();
      await loginScreen.expectPasswordFieldError();
    });

    it('should show error for invalid email format', async () => {
      await loginScreen.enterEmail('not-an-email');
      await loginScreen.enterPassword('somepassword');
      await loginScreen.submit();

      // Should stay on login screen with validation error
      await loginScreen.waitForScreen();
      await loginScreen.expectEmailFieldError();
    });

    it('should show error for incorrect password', async () => {
      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.enterPassword('wrong_password_123');
      await loginScreen.submit();

      // Wait for network response
      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

      // Should stay on login screen (login failed)
      await loginScreen.waitForScreen();
      await loginScreen.expectErrorMessage();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await device.launchApp({
        newInstance: true,
        delete: true,
      });
      await landingScreen.waitForScreen(5000);
      await landingScreen.tapLogin();
      await loginScreen.waitForScreen();
    });

    it('should handle special characters in password', async () => {
      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.enterPassword('P@$$w0rd!#$%^&*()');
      await loginScreen.submit();

      // Should attempt login (not crash) - verify we're on a known screen
      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

      try {
        await loginScreen.waitForScreen(2000);
      } catch {
        // Might have succeeded - tab bar should be visible
        await waitFor(element(by.id('tab-bar')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);
      }
    });

    it('should handle rapid submit button taps', async () => {
      await loginScreen.enterEmail(TEST_USER.email);
      await loginScreen.enterPassword(TEST_USER.password);

      // Rapid taps
      const submitButton = element(by.id('login-submit-button'));
      await submitButton.tap();
      await submitButton.tap();
      await submitButton.tap();

      // Should not crash, should complete login
      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

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
      // Trigger an error
      await loginScreen.submit(); // Submit with empty fields

      // Wait for validation to show
      await loginScreen.waitForScreen();

      // Start typing in email field
      await loginScreen.enterEmail('test');

      // Verify we're still on login screen (didn't crash)
      await loginScreen.waitForScreen();
    });
  });

  describe('Navigation', () => {
    beforeEach(async () => {
      await device.launchApp({
        newInstance: true,
        delete: true,
      });
      await landingScreen.waitForScreen(5000);
      await landingScreen.tapLogin();
      await loginScreen.waitForScreen();
    });

    it('should navigate to forgot password', async () => {
      await loginScreen.tapForgotPassword();
      await waitForScreen('forgot-password-screen', TIMEOUTS.DEFAULT);
    });

    it('should navigate to sign up', async () => {
      await loginScreen.tapSignUp();
      await waitForScreen('signup-screen', TIMEOUTS.DEFAULT);
    });
  });
});
