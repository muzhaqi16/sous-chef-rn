/**
 * Authentication helpers for E2E tests
 *
 * Provides utilities for login/logout and auth state management
 */

import { element, by, waitFor } from 'detox';
import { waitForScreen, waitForElementToBeVisible } from './waitFor';
import { typeIntoField, tapByID } from './actions';
import { TEST_USER } from '../fixtures/testData';

/**
 * Login with test user credentials
 */
export async function loginAsTestUser() {
  await loginWithCredentials(TEST_USER.email, TEST_USER.password);
}

/**
 * Login with custom credentials
 */
export async function loginWithCredentials(email: string, password: string) {
  // Wait for login screen
  await waitForScreen('login-screen');

  // Enter credentials
  await typeIntoField('login-email-input', email);
  await typeIntoField('login-password-input', password);

  // Tap login button
  await tapByID('login-submit-button');

  // Wait for home screen to load
  await waitForScreen('shopping-list-screen', 10000);
}

/**
 * Dismiss biometric prompt if it appears after login or during onboarding
 * Handles both the post-login modal and the onboarding biometric setup screen
 */
export async function dismissBiometricPromptIfPresent() {
  // Try to dismiss post-login biometric modal (appears after login)
  try {
    await waitFor(element(by.id('post-login-biometric-prompt')))
      .toBeVisible()
      .withTimeout(1000);

    // Disable synchronization for modal interactions (Android compatibility)
    await device.disableSynchronization();

    // Tap "Not now" button - try by.id first, fallback to by.label
    try {
      await element(by.id('biometric-prompt-decline')).tap();
    } catch {
      // Fallback to by.label if by.id doesn't work
      await element(by.label('Not now')).tap();
    }

    // Re-enable synchronization
    await device.enableSynchronization();

    // Wait for the prompt to disappear
    await waitFor(element(by.id('post-login-biometric-prompt')))
      .not.toBeVisible()
      .withTimeout(1000);

    return; // Successfully dismissed post-login modal
  } catch {
    // Not the post-login modal, try onboarding screen
  }

  // Try to dismiss onboarding biometric setup screen
  try {
    await waitFor(element(by.id('biometric-setup-screen')))
      .toBeVisible()
      .withTimeout(1000);

    // Disable synchronization for modal interactions (Android compatibility)
    await device.disableSynchronization();

    // Tap "Set up later" button to skip
    await tapByID('biometric-setup-skip');

    // Re-enable synchronization
    await device.enableSynchronization();

    // Wait for the screen to disappear
    await waitFor(element(by.id('biometric-setup-screen')))
      .not.toBeVisible()
      .withTimeout(1000);
  } catch {
    // No biometric prompt present at all, continue
  }

  // Try to dismiss helper overlay if it appears (2 second delay in PantryMain)
  try {
    await waitFor(element(by.id('feature-hint-overlay-dismiss')))
      .toBeVisible()
      .withTimeout(2500); // 2.5s to account for 2s delay in PantryMain

    // Disable synchronization for overlay interactions (Android compatibility)
    await device.disableSynchronization();

    // Tap dismiss button
    await element(by.id('feature-hint-overlay-dismiss')).tap();

    // Re-enable synchronization
    await device.enableSynchronization();

    // Wait for the overlay to disappear
    await waitFor(element(by.id('feature-hint-overlay')))
      .not.toBeVisible()
      .withTimeout(1000);
  } catch {
    // No helper overlay present
  }
}

/**
 * Logout from the app
 */
export async function logout() {
  // Navigate to profile
  await tapByID('tab-profile');
  await waitForScreen('profile-screen');

  // Open settings
  await tapByID('settings-button');
  await waitForScreen('settings-screen');

  // Scroll to bottom to find logout button
  await element(by.id('settings-scroll-view')).scrollTo('bottom');

  // Tap logout
  await tapByID('logout-button');

  // Confirm logout if needed
  try {
    await waitForElementToBeVisible(element(by.id('confirm-logout-button')), 2000);
    await tapByID('confirm-logout-button');
  } catch {
    // No confirmation dialog
  }

  // Wait for login screen
  await waitForScreen('login-screen', 10000);
}

/**
 * Sign up with new user credentials
 */
export async function signUpWithCredentials(
  email: string,
  password: string,
  displayName: string,
) {
  // Wait for signup screen
  await waitForScreen('signup-screen');

  // Enter user details
  await typeIntoField('signup-email-input', email);
  await typeIntoField('signup-password-input', password);
  await typeIntoField('signup-display-name-input', displayName);

  // Tap signup button
  await tapByID('signup-submit-button');

  // Wait for onboarding or home screen
  try {
    await waitForScreen('onboarding-screen', 5000);
  } catch {
    await waitForScreen('shopping-list-screen', 5000);
  }
}

/**
 * Skip to login from landing screen
 */
export async function skipToLogin() {
  try {
    await waitForElementToBeVisible(element(by.id('skip-to-login-button')), 2000);
    await tapByID('skip-to-login-button');
  } catch {
    // Already on login screen
  }
}

/**
 * Navigate to signup from login
 */
export async function navigateToSignup() {
  await tapByID('go-to-signup-button');
  await waitForScreen('signup-screen');
}

/**
 * Navigate to forgot password
 */
export async function navigateToForgotPassword() {
  await tapByID('forgot-password-button');
  await waitForScreen('forgot-password-screen');
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(): Promise<boolean> {
  try {
    await waitForElementToBeVisible(element(by.id('shopping-list-screen')), 2000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure logged in state (login if not already)
 */
export async function ensureLoggedIn() {
  const loggedIn = await isLoggedIn();
  if (!loggedIn) {
    await loginAsTestUser();
  }
}

/**
 * Ensure logged out state (logout if currently logged in)
 */
export async function ensureLoggedOut() {
  const loggedIn = await isLoggedIn();
  if (loggedIn) {
    await logout();
  }
}
