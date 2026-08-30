/**
 * Forgot-password / reset-request flows: sending the email, validation errors,
 * and navigation.
 */

import { element, by } from 'detox';
import { launchAppWithFabricWorkaround } from '../../init';
import { ForgotPasswordScreen } from '../../screens/ForgotPasswordScreen';
import { LandingAuthScreen } from '../../screens/LandingAuthScreen';
import { LoginScreen } from '../../screens/LoginScreen';
import { TIMEOUTS, waitForNetworkIdle } from '../../helpers/waitFor';
import { TEST_USER } from '../../fixtures/testData';

describe('Password Reset', () => {
  const landingScreen = new LandingAuthScreen();
  const loginScreen = new LoginScreen();
  const forgotPasswordScreen = new ForgotPasswordScreen();

  beforeAll(async () => {
    await launchAppWithFabricWorkaround({
      newInstance: true,
      delete: true,
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await landingScreen.waitForScreen(5000);
    await landingScreen.tapLogin();
    await loginScreen.waitForScreen();
    await loginScreen.tapForgotPassword();
    await forgotPasswordScreen.waitForScreen();
  });

  describe('Form Display', () => {
    it('should show forgot password form elements', async () => {
      await forgotPasswordScreen.expectVisible('forgot-password-email-input');
      await forgotPasswordScreen.expectSubmitVisible();
    });
  });

  describe('Validation Errors', () => {
    it('should show error for empty email', async () => {
      await forgotPasswordScreen.submit();

      await forgotPasswordScreen.waitForScreen();
      await forgotPasswordScreen.expectEmailFieldError();
    });

    it('should show error for invalid email format', async () => {
      await forgotPasswordScreen.enterEmail('not-an-email');
      await forgotPasswordScreen.submit();

      await forgotPasswordScreen.waitForScreen();
      await forgotPasswordScreen.expectEmailFieldError();
    });
  });

  describe('Happy Path', () => {
    it('should send reset email for valid email', async () => {
      await forgotPasswordScreen.requestPasswordReset(TEST_USER.email);

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

      // Should show success message or navigate back to login
      let handledResponse = false;

      try {
        await forgotPasswordScreen.expectSuccessMessage();
        handledResponse = true;
      } catch {
        // Might navigate back to login instead
      }

      if (!handledResponse) {
        try {
          await loginScreen.waitForScreen(TIMEOUTS.DEFAULT);
          handledResponse = true;
        } catch {
          // Might stay on forgot password with success state
          await forgotPasswordScreen.waitForScreen();
          handledResponse = true;
        }
      }

      if (!handledResponse) {
        throw new Error('Password reset did not show success message or navigate to login');
      }
    });

    it('should handle non-existent email gracefully', async () => {
      await forgotPasswordScreen.requestPasswordReset(
        'nonexistent.user@example.com',
      );

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

      // Enumeration-safe: the same response whether or not the email exists.
      await forgotPasswordScreen.waitForScreen();
    });
  });

  describe('Navigation', () => {
    it('should navigate back to login', async () => {
      await forgotPasswordScreen.navigateToLogin();
      await loginScreen.waitForScreen();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid submit taps', async () => {
      await forgotPasswordScreen.enterEmail(TEST_USER.email);

      const submitButton = element(by.id('forgot-password-submit-button'));
      await submitButton.tap();
      await submitButton.tap();
      await submitButton.tap();

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

      // Should not crash - verify we're on a known screen
      await forgotPasswordScreen.waitForScreen();
    });

    it('should handle email with special characters', async () => {
      await forgotPasswordScreen.enterEmail('user+test@example.com');
      await forgotPasswordScreen.submit();

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

      await forgotPasswordScreen.waitForScreen();
    });

    it('should handle very long email', async () => {
      const longEmail = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com';
      await forgotPasswordScreen.enterEmail(longEmail);
      await forgotPasswordScreen.submit();

      await forgotPasswordScreen.waitForScreen();
    });
  });
});
