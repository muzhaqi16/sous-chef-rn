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

import { element, by, waitFor, system } from 'detox';
import {
  waitForScreen,
  waitForModalReady,
  waitForModalClosed,
  waitForElementAndTap,
  waitIfPresent,
  waitForNetworkIdle,
  tapFirstAvailable,
  delay,
  TIMEOUTS,
} from './waitFor';
import { typeIntoField, tapByID } from './actions';
import { TEST_USER } from '../fixtures/testData';
import { launchAppWithFabricWorkaround } from '../init';
import { ApiUnreachableError, getAuthTokens } from './tokenProvider';

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

  // Wait for home screen to load. Which tab is the landing tab varies, so
  // either counts — but neither appearing means login did not complete, and
  // this MUST throw. Warning and continuing let a failed login return
  // successfully, so every spec built on this helper went on to assert against
  // whatever screen happened to be up.
  try {
    await waitForScreen('shopping-list-screen', TIMEOUTS.NETWORK);
    console.log('✅ Reached home screen');
  } catch {
    // Might land on pantry screen instead
    try {
      await waitForScreen('pantry-screen', TIMEOUTS.NETWORK);
      console.log('✅ Reached pantry screen');
    } catch {
      throw new Error(
        'Login did not reach a home screen: neither shopping-list-screen nor ' +
          'pantry-screen became visible after authentication.',
      );
    }
  }

  // Handle post-login flows
  await dismissBiometricPromptIfPresent();
}

/**
 * ⭐ ENHANCED: Dismiss biometric prompt if it appears after login or during onboarding
 * NO synchronization disabling - uses proper waitFor conditions
 */
/**
 * How long to give iOS's "Save Password?" alert. It only appears on the first
 * UI login of a fresh install, so on most runs this is simply waited out once.
 */
const SYSTEM_ALERT_TIMEOUT_MS = 3000;

let systemPasswordAlertHandled = false;

export async function dismissBiometricPromptIfPresent() {
  console.log('🔍 Checking for post-login prompts...');

  // The "Remember login info?" credential modal appears after a fresh UI
  // login and blocks the tab bar until dismissed.
  await waitIfPresent(
    element(by.id('remember-me-modal')),
    async () => {
      console.log('📱 Dismissing remember-login-info prompt...');
      await tapFirstAvailable([
        element(by.id('remember-me-decline')),
        element(by.text('Not Now')),
      ]);
      console.log('✅ Remember-login prompt dismissed');
    },
    3000,
  );

  // iOS's own "Save Password?" alert after a UI login. It is a SYSTEM alert,
  // not part of the app's view tree, so `by.id` and `by.text` cannot see it —
  // the previous id-based probe waited 3s and moved on while the alert went
  // on blocking every subsequent tap. Detox's
  // system matcher is the only thing that reaches it.
  //
  // Wrapped because it appears only on some simulators and only on the first
  // login of a fresh install.
  // It is presented asynchronously after the login response lands, so tapping
  // immediately races it: the tap finds nothing, the catch swallows that, and
  // the alert then blocks every subsequent tap with
  // "View is not hittable at its visible point".
  // Once per process: iOS offers to save the password on the first UI login of
  // a fresh install and never again, but this helper runs in every `beforeEach`
  // — so an unconditional 4s wait would add 4s per test for an alert that
  // cannot reappear.
  if (!systemPasswordAlertHandled) {
    // Polled rather than awaited through `waitFor`: Detox's `waitFor` is typed
    // for a NativeElement, and a system element is a separate type it does not
    // accept. The alert is also presented asynchronously after the login
    // response lands, so a single immediate tap races it — the tap finds
    // nothing, and the alert then blocks every subsequent one with
    // "View is not hittable at its visible point".
    // Raced against a timer, because `system.element(...).tap()` BLOCKS when
    // no system alert is present — it does not throw, and Detox's `waitFor` is
    // typed for a NativeElement so it cannot bound this. An unbounded attempt
    // runs out jest's 120s HOOK timeout, and every test in the file then
    // reports as "Exceeded timeout of 120000 ms for a hook" pointing at
    // `beforeAll`, with the app sitting there perfectly healthy.
    const dismissed = await Promise.race([
      system
        .element(by.system.label('Not Now'))
        .tap()
        .then(() => true)
        .catch(() => false),
      delay(SYSTEM_ALERT_TIMEOUT_MS).then(() => false),
    ]);
    if (dismissed) {
      console.log('✅ Dismissed the system "Save Password?" alert');
    }
    systemPasswordAlertHandled = true;
  }

  // Try to dismiss onboarding biometric setup screen (only on real devices)
  await waitIfPresent(
    element(by.id('biometric-setup-screen')),
    async () => {
      console.log('📱 Skipping onboarding biometric setup...');
      await tapByID('biometric-setup-skip');
      console.log('✅ Biometric setup skipped');
    },
    3000,
  );

  // Try to dismiss feature hint overlay (appears with 2s delay in PantryMain)
  await waitIfPresent(
    element(by.id('feature-hint-overlay-dismiss')),
    async () => {
      console.log('💡 Dismissing feature hint overlay...');
      await element(by.id('feature-hint-overlay-dismiss')).tap();
      console.log('✅ Feature hint dismissed');
    },
    2500, // Allow 2.5s for the overlay to appear (has 2s delay)
  );

  console.log('✅ All post-login flows handled');
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
  await typeIntoField('signup-name-input', displayName, true);

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
 * Navigate to login from landing screen
 */
export async function skipToLogin() {
  await waitIfPresent(
    element(by.id('landing-login-button')),
    async () => {
      console.log('Navigating to login from landing screen...');
      await tapByID('landing-login-button');
      await waitForScreen('login-screen', TIMEOUTS.DEFAULT);
    },
    5000, // Increased timeout to account for splash screen
  );
}

/**
 * Navigate to signup from login
 */
export async function navigateToSignup() {
  console.log('Navigating to signup...');
  await tapByID('login-signup-link');
  await waitForScreen('signup-screen', TIMEOUTS.DEFAULT);
}

/**
 * Navigate to forgot password
 */
export async function navigateToForgotPassword() {
  console.log('Navigating to forgot password...');
  await tapByID('login-forgot-password-link');
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

export interface BootstrapOptions {
  /**
   * Seed the pantry sort so list order is known before the first frame.
   *
   * The alternative is driving the sort modal, which costs two open/select
   * round-trips per test AND has to wait for the control to exist at all — it
   * renders under `{!!stats && …}`, so it does not appear until the stats query
   * resolves. Seeding a value the test already knows removes both the taps and
   * the wait.
   *
   * Note `recent` sorts newest-first under `asc`: its comparator is inverted
   * relative to the other options (`b - a`), which `usePantrySorting.test.ts`
   * asserts. The app's own default is `recent` + `desc` — oldest first.
   */
  pantrySort?: {
    option: 'name' | 'expiry' | 'quantity' | 'recent';
    direction: 'asc' | 'desc';
  };
}

/**
 * ⭐ ENHANCED: Bootstrap authenticated session for tests
 * Uses token injection via launchArgs for speed (~1s vs ~5-8s UI login).
 * Falls back to UI login if token injection fails.
 */
export async function bootstrapAuthenticatedSession(
  options: BootstrapOptions = {},
) {
  console.log('🚀 Bootstrapping authenticated session...');

  // Seeded on BOTH launch paths below. `reloadReactNative` (what
  // `relaunchToHomeTab` uses between tests) keeps the original launch args, and
  // the preference is persisted anyway, so seeding once here holds for the whole
  // file.
  const preferenceArgs = options.pantrySort
    ? {
        detoxPantrySortOption: options.pantrySort.option,
        detoxPantrySortDirection: options.pantrySort.direction,
      }
    : {};

  // Try token injection first (fast path)
  try {
    const tokens = await getAuthTokens();
    console.log('🔑 Launching app with injected auth tokens...');

    await launchAppWithFabricWorkaround({
      newInstance: true,
      permissions: { notifications: 'YES', camera: 'YES' },
      launchArgs: {
        detoxUserToken: tokens.accessToken,
        detoxRefreshToken: tokens.refreshToken,
        detoxUser: JSON.stringify(tokens.user),
        ...preferenceArgs,
      },
    });

    // Check if token injection worked (should land on home screen)
    const loggedIn = await isLoggedIn();
    if (loggedIn) {
      console.log('✅ Token injection successful');
      await dismissBiometricPromptIfPresent();
      return;
    }

    console.log(
      '⚠️ Token injection did not result in logged-in state, falling back to UI login...',
    );
  } catch (error) {
    // The one failure the fallback cannot rescue: UI login posts to the same
    // endpoint. Surface it as itself instead of spending ~50s to report a
    // missing `login-screen`.
    if (error instanceof ApiUnreachableError) {
      throw error;
    }

    console.log(
      `⚠️ Token injection failed: ${error}, falling back to UI login...`,
    );

    // Launch without tokens
    await launchAppWithFabricWorkaround({
      newInstance: true,
      permissions: { notifications: 'YES', camera: 'YES' },
      launchArgs: preferenceArgs,
    });
  }

  // Fallback: UI login
  const loggedIn = await isLoggedIn();

  if (loggedIn) {
    console.log('Already logged in, keeping session...');
  } else {
    console.log('Not logged in, creating new session...');
    await skipToLogin();
    await loginAsTestUser();
    await dismissBiometricPromptIfPresent();
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
