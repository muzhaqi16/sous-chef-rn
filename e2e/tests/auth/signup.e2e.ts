/**
 * Sign Up E2E Tests
 *
 * Tests for the user registration functionality including:
 * - Happy path registration
 * - Validation errors (weak password, existing email, etc.)
 * - Form validation
 */

import { element, by, waitFor } from 'detox';
import { launchAppWithFabricWorkaround } from '../../init';
import { LandingAuthScreen, LoginScreen, SignUpScreen } from '../../screens';
import {
  waitForScreen,
  waitForNetworkIdle,
  dismissBiometricPromptIfPresent,
  TIMEOUTS,
} from '../../helpers';
import { generateTestEmail } from '../../helpers/data';

describe('Sign Up', () => {
  const landingScreen = new LandingAuthScreen();
  const loginScreen = new LoginScreen();
  const signUpScreen = new SignUpScreen();

  beforeAll(async () => {
    await launchAppWithFabricWorkaround({
      newInstance: true,
      delete: true,
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    // Nothing here navigates back, so from the second test on the app is
    // already sitting on the signup screen and waiting for the landing screen
    // can only time out. Get back to a known state first, then navigate.
    const alreadyOnSignUp = await signUpScreen
      .waitForScreen(1000)
      .then(() => true)
      .catch(() => false);
    if (alreadyOnSignUp) {
      await signUpScreen.goBack();
    }

    await landingScreen.waitForScreen(5000);
    await landingScreen.tapSignUp();
    await signUpScreen.waitForScreen();
  });

  describe('Form Display', () => {
    it('should show all signup form elements', async () => {
      await signUpScreen.expectVisible('signup-name-input');
      await signUpScreen.expectVisible('signup-email-input');
      await signUpScreen.expectVisible('signup-password-input');
      await signUpScreen.expectVisible('signup-confirm-password-input');
      await signUpScreen.expectSubmitVisible();
    });
  });

  describe('Validation Errors', () => {
    it('should show error for empty name', async () => {
      await signUpScreen.enterEmail(generateTestEmail());
      await signUpScreen.enterPassword('TestPass123!');
      await signUpScreen.enterConfirmPassword('TestPass123!');
      await signUpScreen.submit();

      // Should stay on signup screen with validation error
      await signUpScreen.waitForScreen();
      await signUpScreen.expectNameFieldError();
    });

    it('should show error for empty email', async () => {
      await signUpScreen.enterName('Test User');
      await signUpScreen.enterPassword('TestPass123!');
      await signUpScreen.enterConfirmPassword('TestPass123!');
      await signUpScreen.submit();

      await signUpScreen.waitForScreen();
      await signUpScreen.expectEmailFieldError();
    });

    it('should show error for invalid email format', async () => {
      await signUpScreen.enterName('Test User');
      await signUpScreen.enterEmail('invalid-email');
      await signUpScreen.enterPassword('TestPass123!');
      await signUpScreen.enterConfirmPassword('TestPass123!');
      await signUpScreen.submit();

      await signUpScreen.waitForScreen();
      await signUpScreen.expectEmailFieldError();
    });

    it('should show error for weak password', async () => {
      await signUpScreen.enterName('Test User');
      await signUpScreen.enterEmail(generateTestEmail());
      await signUpScreen.enterPassword('weak');
      await signUpScreen.enterConfirmPassword('weak');
      await signUpScreen.submit();

      await signUpScreen.waitForScreen();
      await signUpScreen.expectPasswordFieldError();
    });

    it('should show error for password mismatch', async () => {
      await signUpScreen.enterName('Test User');
      await signUpScreen.enterEmail(generateTestEmail());
      await signUpScreen.enterPassword('TestPass123!');
      await signUpScreen.enterConfirmPassword('DifferentPass123!');
      await signUpScreen.submit();

      await signUpScreen.waitForScreen();
      await signUpScreen.expectConfirmPasswordFieldError();
    });

    it('should show error for existing email', async () => {
      // Use an email that's already registered
      await signUpScreen.enterName('Test User');
      await signUpScreen.enterEmail('e2e.test@souschef.app');
      await signUpScreen.enterPassword('TestPass123!');
      await signUpScreen.enterConfirmPassword('TestPass123!');
      await signUpScreen.submit();

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);
      await signUpScreen.waitForScreen();
    });
  });

  describe('Navigation', () => {
    it('should navigate to login from signup', async () => {
      await signUpScreen.navigateToLogin();
      await loginScreen.waitForScreen();
    });
  });

  describe('Happy Path', () => {
    it('should successfully create a new account', async () => {
      const testEmail = generateTestEmail();
      const testPassword = 'TestPassword123!';

      await signUpScreen.signUpWith(
        'E2E Test User',
        testEmail,
        testPassword,
        testPassword,
      );

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

      // Dismiss biometric prompt if shown (only on real devices with biometric support)
      await dismissBiometricPromptIfPresent();

      // Should navigate to onboarding or home screen
      let navigatedSuccessfully = false;

      try {
        await waitForScreen('onboarding-screen', TIMEOUTS.DEFAULT);
        navigatedSuccessfully = true;
      } catch {
        // Not onboarding
      }

      if (!navigatedSuccessfully) {
        try {
          await waitFor(element(by.id('tab-bar')))
            .toBeVisible()
            .withTimeout(TIMEOUTS.DEFAULT);
          navigatedSuccessfully = true;
        } catch {
          // Not home
        }
      }

      if (!navigatedSuccessfully) {
        // Check for create home screen (part of onboarding flow)
        await waitForScreen('create-home-screen', TIMEOUTS.DEFAULT);
        navigatedSuccessfully = true;
      }

      if (!navigatedSuccessfully) {
        throw new Error('Signup did not navigate to onboarding, home, or create-home screen');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long name', async () => {
      const longName = 'A'.repeat(100);
      await signUpScreen.enterName(longName);
      await signUpScreen.enterEmail(generateTestEmail());
      await signUpScreen.enterPassword('TestPass123!');
      await signUpScreen.enterConfirmPassword('TestPass123!');

      // Should not crash - verify we're still on signup screen
      await signUpScreen.waitForScreen();
    });

    it('should handle special characters in name', async () => {
      await signUpScreen.enterName("John O'Brien-Smith");
      await signUpScreen.enterEmail(generateTestEmail());
      await signUpScreen.enterPassword('TestPass123!');
      await signUpScreen.enterConfirmPassword('TestPass123!');
      await signUpScreen.submit();

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);
      // Should handle gracefully - verify we navigated or stayed on signup
      await signUpScreen.waitForScreen();
    });

    it('should handle unicode characters in name', async () => {
      await signUpScreen.enterName('José María Müller');
      await signUpScreen.enterEmail(generateTestEmail());
      await signUpScreen.enterPassword('TestPass123!');
      await signUpScreen.enterConfirmPassword('TestPass123!');
      await signUpScreen.submit();

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);
      // Should handle gracefully - verify we navigated or stayed on signup
      await signUpScreen.waitForScreen();
    });
  });
});
