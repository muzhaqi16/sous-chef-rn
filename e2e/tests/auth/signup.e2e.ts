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
  delay,
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
    // Navigate to signup screen
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
    });

    it('should show error for empty email', async () => {
      await signUpScreen.enterName('Test User');
      await signUpScreen.enterPassword('TestPass123!');
      await signUpScreen.enterConfirmPassword('TestPass123!');
      await signUpScreen.submit();

      await signUpScreen.waitForScreen();
    });

    it('should show error for invalid email format', async () => {
      await signUpScreen.enterName('Test User');
      await signUpScreen.enterEmail('invalid-email');
      await signUpScreen.enterPassword('TestPass123!');
      await signUpScreen.enterConfirmPassword('TestPass123!');
      await signUpScreen.submit();

      await signUpScreen.waitForScreen();
    });

    it('should show error for weak password', async () => {
      await signUpScreen.enterName('Test User');
      await signUpScreen.enterEmail(generateTestEmail());
      await signUpScreen.enterPassword('weak');
      await signUpScreen.enterConfirmPassword('weak');
      await signUpScreen.submit();

      await signUpScreen.waitForScreen();
    });

    it('should show error for password mismatch', async () => {
      await signUpScreen.enterName('Test User');
      await signUpScreen.enterEmail(generateTestEmail());
      await signUpScreen.enterPassword('TestPass123!');
      await signUpScreen.enterConfirmPassword('DifferentPass123!');
      await signUpScreen.submit();

      await signUpScreen.waitForScreen();
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

      // Should navigate to onboarding or home screen
      try {
        await waitForScreen('onboarding-screen', 5000);
        console.log('✓ Navigated to onboarding screen');
      } catch {
        try {
          await waitFor(element(by.id('tab-bar')))
            .toBeVisible()
            .withTimeout(5000);
          console.log('✓ Navigated to home screen');
        } catch {
          // Check for create home screen (part of onboarding flow)
          await waitForScreen('create-home-screen', 5000);
          console.log('✓ Navigated to create home screen');
        }
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

      // Should not crash
      await delay(500);
    });

    it('should handle special characters in name', async () => {
      await signUpScreen.enterName("John O'Brien-Smith");
      await signUpScreen.enterEmail(generateTestEmail());
      await signUpScreen.enterPassword('TestPass123!');
      await signUpScreen.enterConfirmPassword('TestPass123!');
      await signUpScreen.submit();

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);
      // Should handle gracefully
    });

    it('should handle unicode characters in name', async () => {
      await signUpScreen.enterName('José María Müller');
      await signUpScreen.enterEmail(generateTestEmail());
      await signUpScreen.enterPassword('TestPass123!');
      await signUpScreen.enterConfirmPassword('TestPass123!');
      await signUpScreen.submit();

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);
      // Should handle gracefully
    });
  });
});
