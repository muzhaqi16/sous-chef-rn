/**
 * ⭐ ENHANCED Authentication helpers for E2E tests
 *
 * Provides utilities for login/logout and auth state management
 *
 * BEST PRACTICES:
 * - NO device.disableSynchronization() usage
 * - Proper modal/overlay handling with waitFor conditions
 * - Android-first error detection (no toast reliance)
 * - Detailed logging for debugging
 */

import { element, by, waitFor } from 'detox';
import {
  waitForScreen,
  waitForElementToBeVisible,
  waitForModalReady,
  waitForModalClosed,
  waitForElementAndTap,
  waitIfPresent,
  waitForNetworkIdle,
  delay,
  TIMEOUTS,
} from './waitFor';
import { typeIntoField, tapByID } from './actions';
import { TEST_USER } from '../fixtures/testData';

/**
 * ⭐ ENHANCED: Login with test user credentials
 */
export async function loginAsTestUser() {
  console.log(`🔐 Logging in as test user: ${TEST_USER.email}`);
  await loginWithCredentials(TEST_USER.email, TEST_USER.password);
  console.log('✅ Login successful');
}

/**
 * ⭐ ENHANCED: Login with custom credentials
 */
export async function loginWithCredentials(email: string, password: string) {
  console.log(`🔐 Logging in with email: ${email}`);

  // Wait for login screen
  await waitForScreen('login-screen', TIMEOUTS.NETWORK);

  // Enter credentials with keyboard handling
  await typeIntoField('login-email-input', email, true);
  await typeIntoField('login-password-input', password, true);

  // Tap login button
  await tapByID('login-submit-button');

  console.log('⏳ Waiting for authentication...');

  // Wait for network request to complete
  await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

  // Check if we're still on login screen (error state)
  try {
    await waitFor(element(by.id('login-screen')))
      .toBeVisible()
      .withTimeout(2000);

    // Still on login screen = login failed
    console.error('❌ Login failed - still on login screen');
    throw new Error('Login failed: Invalid credentials or network error');
  } catch (error) {
    // Not on login screen anymore = success, continue
    if (error instanceof Error && error.message.includes('Login failed')) {
      throw error;
    }
  }

  // Wait for home screen to load (shopping list is the default tab)
  try {
    await waitForScreen('shopping-list-screen', TIMEOUTS.NETWORK);
    console.log('✅ Reached home screen');
  } catch {
    // Might land on pantry screen instead
    try {
      await waitForScreen('pantry-screen', TIMEOUTS.NETWORK);
      console.log('✅ Reached pantry screen');
    } catch {
      console.warn('⚠️  Neither shopping list nor pantry screen visible after login');
    }
  }

  // Handle post-login flows
  await dismissBiometricPromptIfPresent();
}

/**
 * ⭐ ENHANCED: Dismiss biometric prompt if it appears after login or during onboarding
 * NO synchronization disabling - uses proper waitFor conditions
 */
export async function dismissBiometricPromptIfPresent() {
  console.log('🔍 Checking for biometric prompts...');

  // Try to dismiss post-login biometric modal (appears after login)
  await waitIfPresent(
    element(by.id('post-login-biometric-prompt')),
    async () => {
      console.log('📱 Dismissing post-login biometric prompt...');

      await waitForModalReady('post-login-biometric-prompt');

      // Tap "Not now" button - try by.id first, fallback to by.label
      try {
        await waitForElementAndTap(element(by.id('biometric-prompt-decline')));
      } catch {
        console.log('Trying fallback selector for biometric prompt...');
        await waitForElementAndTap(element(by.label('Not now')));
      }

      // Wait for modal to close completely
      await waitForModalClosed('post-login-biometric-prompt');

      console.log('✅ Biometric prompt dismissed');
    },
    2000,
  );

  // Try to dismiss onboarding biometric setup screen
  await waitIfPresent(
    element(by.id('biometric-setup-screen')),
    async () => {
      console.log('📱 Skipping onboarding biometric setup...');

      await waitForScreen('biometric-setup-screen', 2000);

      // Tap "Set up later" button to skip
      await tapByID('biometric-setup-skip');

      // Wait for screen to disappear
      await waitFor(element(by.id('biometric-setup-screen')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      console.log('✅ Biometric setup skipped');
    },
    2000,
  );

  // Try to dismiss feature hint overlay (appears with 2s delay in PantryMain)
  await waitIfPresent(
    element(by.id('feature-hint-overlay-dismiss')),
    async () => {
      console.log('💡 Dismissing feature hint overlay...');

      await waitForModalReady('feature-hint-overlay', 3000);

      // Tap dismiss button
      await waitForElementAndTap(element(by.id('feature-hint-overlay-dismiss')));

      // Wait for overlay to disappear
      await waitForModalClosed('feature-hint-overlay');

      console.log('✅ Feature hint dismissed');
    },
    3000, // 3s timeout to account for 2s delay in PantryMain
  );

  console.log('✅ All post-login flows handled');
}

/**
 * ⭐ ENHANCED: Logout from the app
 */
export async function logout() {
  console.log('🚪 Logging out...');

  // Navigate to profile
  await tapByID('tab-profile');
  await waitForScreen('profile-screen', TIMEOUTS.DEFAULT);

  // Open settings
  await tapByID('settings-button');
  await waitForScreen('settings-screen', TIMEOUTS.DEFAULT);

  // Scroll to bottom to find logout button
  const settingsScroll = element(by.id('settings-scroll-view'));
  await waitFor(settingsScroll).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
  await settingsScroll.scrollTo('bottom');
  await delay(300); // Wait for scroll animation

  // Tap logout
  await tapByID('logout-button');

  // Confirm logout if confirmation dialog appears
  await waitIfPresent(
    element(by.id('confirm-logout-button')),
    async () => {
      console.log('Confirming logout...');
      await tapByID('confirm-logout-button');
    },
    2000,
  );

  // Wait for login screen
  await waitForScreen('login-screen', TIMEOUTS.NETWORK);

  console.log('✅ Logged out successfully');
}

/**
 * ⭐ ENHANCED: Sign up with new user credentials
 */
export async function signUpWithCredentials(
  email: string,
  password: string,
  displayName: string,
) {
  console.log(`📝 Signing up new user: ${email}`);

  // Wait for signup screen
  await waitForScreen('signup-screen', TIMEOUTS.DEFAULT);

  // Enter user details with keyboard handling
  await typeIntoField('signup-email-input', email, true);
  await typeIntoField('signup-password-input', password, true);
  await typeIntoField('signup-display-name-input', displayName, true);

  // Tap signup button
  await tapByID('signup-submit-button');

  console.log('⏳ Waiting for signup to complete...');

  // Wait for network request
  await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

  // Check if signup succeeded (either onboarding or home screen)
  try {
    await waitForScreen('onboarding-screen', 5000);
    console.log('✅ Signup successful - onboarding screen shown');
  } catch {
    try {
      await waitForScreen('shopping-list-screen', 5000);
      console.log('✅ Signup successful - home screen shown');
    } catch {
      // Still on signup screen = error
      console.error('❌ Signup failed');
      throw new Error('Signup failed: Check credentials or network');
    }
  }
}

/**
 * Skip to login from landing screen
 */
export async function skipToLogin() {
  await waitIfPresent(
    element(by.id('skip-to-login-button')),
    async () => {
      console.log('Skipping to login...');
      await tapByID('skip-to-login-button');
      await waitForScreen('login-screen', TIMEOUTS.DEFAULT);
    },
    2000,
  );
}

/**
 * Navigate to signup from login
 */
export async function navigateToSignup() {
  console.log('Navigating to signup...');
  await tapByID('go-to-signup-button');
  await waitForScreen('signup-screen', TIMEOUTS.DEFAULT);
}

/**
 * Navigate to forgot password
 */
export async function navigateToForgotPassword() {
  console.log('Navigating to forgot password...');
  await tapByID('forgot-password-button');
  await waitForScreen('forgot-password-screen', TIMEOUTS.DEFAULT);
}

/**
 * ⭐ ENHANCED: Check if user is logged in
 */
export async function isLoggedIn(): Promise<boolean> {
  try {
    // Check for any home screen (shopping list or pantry)
    await waitFor(element(by.id('tab-bar')))
      .toBeVisible()
      .withTimeout(2000);
    return true;
  } catch {
    return false;
  }
}

/**
 * ⭐ ENHANCED: Ensure logged in state (login if not already)
 */
export async function ensureLoggedIn() {
  console.log('🔍 Checking login state...');

  const loggedIn = await isLoggedIn();

  if (!loggedIn) {
    console.log('Not logged in, logging in now...');
    await loginAsTestUser();
  } else {
    console.log('✅ Already logged in');
  }
}

/**
 * ⭐ ENHANCED: Ensure logged out state (logout if currently logged in)
 */
export async function ensureLoggedOut() {
  console.log('🔍 Checking logout state...');

  const loggedIn = await isLoggedIn();

  if (loggedIn) {
    console.log('Currently logged in, logging out now...');
    await logout();
  } else {
    console.log('✅ Already logged out');
  }
}

/**
 * ⭐ NEW: Reset app state to clean session
 * Use this between test suites for app reuse
 */
export async function resetAppState() {
  console.log('🔄 Resetting app state...');

  // Clear app data without reinstalling
  await device.clearKeychain();

  // Reload app to reset in-memory state
  await device.reloadReactNative();

  // Wait for app to reload
  await delay(2000);

  console.log('✅ App state reset');
}

/**
 * ⭐ NEW: Bootstrap authenticated session for tests
 * Combines login + post-login flow handling for test setup
 */
export async function bootstrapAuthenticatedSession() {
  console.log('🚀 Bootstrapping authenticated session...');

  // Ensure we start from logged out state
  const loggedIn = await isLoggedIn();

  if (loggedIn) {
    console.log('Already logged in, keeping session...');
  } else {
    console.log('Not logged in, creating new session...');

    // Handle landing screen if present
    await skipToLogin();

    // Login
    await loginAsTestUser();
  }

  // Ensure we're on a known screen (pantry or shopping list)
  try {
    await waitForScreen('shopping-list-screen', 3000);
  } catch {
    try {
      await waitForScreen('pantry-screen', 3000);
    } catch {
      // If neither, navigate to shopping list
      await tapByID('tab-shoppinglist');
      await waitForScreen('shopping-list-screen', TIMEOUTS.DEFAULT);
    }
  }

  console.log('✅ Authenticated session ready');
}
