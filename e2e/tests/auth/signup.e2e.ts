/**
 * Sign up: the form's validation, a new account signing in to the verification
 * gate, and a taken address landing on signed-out code entry.
 *
 * `register` allows 5 calls an hour per IP, held in Redis, so only two tests
 * spend one. The code travels only by mail, so the happy path goes on by the
 * gate's skip; the name cases stop at client validation.
 */

import { device } from 'detox';
import { launchAppWithFabricWorkaround } from '../../init';
import { CodeVerificationScreen } from '../../screens/CodeVerificationScreen';
import { LandingAuthScreen } from '../../screens/LandingAuthScreen';
import { LoginScreen } from '../../screens/LoginScreen';
import { CreateHomeScreen } from '../../screens/OnboardingScreens';
import { SignUpScreen } from '../../screens/SignUpScreen';
import { TIMEOUTS } from '../../helpers/waitFor';
import { generateTestEmail } from '../../helpers/data';
import { TEST_USER } from '../../fixtures/testData';
import { authTestIDs } from '../../../src/features/auth/testIDs';

const VALID_PASSWORD = 'TestPass123!';

describe('Sign Up', () => {
  const landingScreen = new LandingAuthScreen();
  const loginScreen = new LoginScreen();
  const signUpScreen = new SignUpScreen();
  const codeVerificationScreen = new CodeVerificationScreen();
  const createHomeScreen = new CreateHomeScreen();

  beforeAll(async () => {
    await launchAppWithFabricWorkaround({
      newInstance: true,
      delete: true,
      permissions: { notifications: 'YES' },
    });
  });

  /**
   * An EMPTY form every time. Tests end on the form with values and errors
   * left in it, on code entry, or on login, and a reload resets all three to
   * the landing screen.
   */
  beforeEach(async () => {
    await device.reloadReactNative();
    await landingScreen.waitForScreen(TIMEOUTS.LONG);
    await landingScreen.tapSignUp();
    await signUpScreen.waitForScreen();
  });

  describe('Form Display', () => {
    it('should show all signup form elements', async () => {
      await signUpScreen.expectVisible(authTestIDs.signUpNameInput);
      await signUpScreen.expectVisible(authTestIDs.signUpEmailInput);
      await signUpScreen.expectVisible(authTestIDs.signUpPasswordInput);
      await signUpScreen.expectVisible(authTestIDs.signUpConfirmPasswordInput);
      await signUpScreen.expectSubmitVisible();
    });
  });

  describe('Validation Errors', () => {
    it('should show error for empty name', async () => {
      await signUpScreen.enterEmail(generateTestEmail());
      await signUpScreen.enterPassword(VALID_PASSWORD);
      await signUpScreen.enterConfirmPassword(VALID_PASSWORD);
      await signUpScreen.submit();

      await signUpScreen.waitForScreen();
      await signUpScreen.expectNameFieldError();
    });

    it('should show error for empty email', async () => {
      await signUpScreen.enterName('Test User');
      await signUpScreen.enterPassword(VALID_PASSWORD);
      await signUpScreen.enterConfirmPassword(VALID_PASSWORD);
      await signUpScreen.submit();

      await signUpScreen.waitForScreen();
      await signUpScreen.expectEmailFieldError();
    });

    it('should show error for invalid email format', async () => {
      await signUpScreen.enterName('Test User');
      await signUpScreen.enterEmail('invalid-email');
      await signUpScreen.enterPassword(VALID_PASSWORD);
      await signUpScreen.enterConfirmPassword(VALID_PASSWORD);
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
      await signUpScreen.enterPassword(VALID_PASSWORD);
      await signUpScreen.enterConfirmPassword('DifferentPass123!');
      await signUpScreen.submit();

      await signUpScreen.waitForScreen();
      await signUpScreen.expectConfirmPasswordFieldError();
    });
  });

  describe('Existing Email', () => {
    // Registration is existence-blind, and the sign-in that follows it is
    // refused for another account's address, so there is no refusal to show.
    it('should land on code entry with no refusal shown', async () => {
      await signUpScreen.signUpWith(
        'Test User',
        TEST_USER.email,
        VALID_PASSWORD,
      );

      await codeVerificationScreen.waitForScreen(TIMEOUTS.LONG);
      await codeVerificationScreen.expectResendOffered();
    });
  });

  describe('Navigation', () => {
    it('should navigate to login from signup', async () => {
      await signUpScreen.navigateToLogin();
      await loginScreen.waitForScreen();
    });
  });

  describe('Happy Path', () => {
    it('should create an account, sign it in, and let the code wait', async () => {
      await signUpScreen.signUpWith(
        'E2E Test User',
        generateTestEmail(),
        VALID_PASSWORD,
      );

      await codeVerificationScreen.waitForScreen(TIMEOUTS.LONG);
      await codeVerificationScreen.expectResendOffered();

      await codeVerificationScreen.skip();
      await createHomeScreen.waitForScreen(TIMEOUTS.LONG);
    });
  });

  /**
   * A mismatched confirmation keeps each submit off the network while the whole
   * schema still runs, so no name error beside that one means the name passed.
   * The API takes any name of 1-255 characters.
   */
  describe('Name Edge Cases', () => {
    async function submitWithName(enterName: () => Promise<void>) {
      await enterName();
      await signUpScreen.enterEmail(generateTestEmail());
      await signUpScreen.enterPassword(VALID_PASSWORD);
      await signUpScreen.enterConfirmPassword('DifferentPass123!');
      await signUpScreen.submit();

      await signUpScreen.expectConfirmPasswordFieldError();
      await signUpScreen.expectNoNameFieldError();
    }

    it('should accept a very long name', async () => {
      await submitWithName(() => signUpScreen.pasteName('A'.repeat(100)));
    });

    it('should accept special characters in name', async () => {
      await submitWithName(() => signUpScreen.enterName("John O'Brien-Smith"));
    });

    it('should accept unicode characters in name', async () => {
      await submitWithName(() => signUpScreen.pasteName('José María Müller'));
    });
  });
});
