/**
 * Forgot-password / reset-request flows: sending the email, validation errors,
 * and navigation.
 */

import { element, by, expect } from 'detox';
import { launchAppWithFabricWorkaround } from '../../init';
import { ForgotPasswordScreen } from '../../screens/ForgotPasswordScreen';
import { LandingAuthScreen } from '../../screens/LandingAuthScreen';
import { LoginScreen } from '../../screens/LoginScreen';
import {
  exists,
  TIMEOUTS,
  waitForNetworkIdle,
} from '../../helpers/waitFor';
import { generateTestEmail } from '../../helpers/data';
import { TEST_USER } from '../../fixtures/testData';

/**
 * Two limits bound this file and clear differently: 5/hour per IP (Redis,
 * survives an API restart) and 3/hour per ADDRESS (in-memory, cleared BY a
 * restart). Only two tests submit, and only the first reuses `TEST_USER.email`
 * — its point is that a known address behaves like an unknown one.
 */
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

  /**
   * Reach the request FORM from wherever the previous test finished. A
   * submitted request lands on the sent view, whose only way out is its own
   * back-to-login button — so assuming the landing screen here fails every
   * test after the first successful submit.
   */
  beforeEach(async () => {
    // An in-app alert (a refusal, a rate limit) covers everything behind it, so
    // every probe below reads as "not visible" until it is dismissed. Detox's
    // system-alert matchers cannot reach it — `alertService` renders its own
    // modal — so it is dismissed by testID.
    if (await exists('alert-modal')) {
      await element(by.id('alert-button-0')).tap();
    }

    if (await exists('forgot-password-screen')) return;

    if (await exists('forgot-password-sent')) {
      await element(by.id('forgot-password-back-to-login-button')).tap();
    } else if (await exists('landing-auth-screen')) {
      await landingScreen.tapLogin();
    }

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
    it('shows the sent view, and the form cannot be submitted again', async () => {
      await forgotPasswordScreen.requestPasswordReset(TEST_USER.email);

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

      await forgotPasswordScreen.expectSuccessMessage();
      // Re-submission is prevented structurally, not by a debounce: one submit
      // replaces the form, so there is no second submit to make.
      await expect(
        element(by.id('forgot-password-submit-button')),
      ).not.toExist();
    });

    it('does not reveal whether the address exists', async () => {
      // A FRESH absent address each run. A fixed one would spend the per-email
      // budget below, and this test only needs the address to have no account.
      await forgotPasswordScreen.requestPasswordReset(generateTestEmail());

      await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

      // Enumeration-safe: the sent view either way, so this must not differ
      // from the valid-email case above.
      await forgotPasswordScreen.expectSuccessMessage();
    });
  });

  describe('Navigation', () => {
    it('should navigate back to login', async () => {
      await forgotPasswordScreen.navigateToLogin();
      await loginScreen.waitForScreen();
    });
  });
});
