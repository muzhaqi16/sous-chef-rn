/**
 * Login/logout and auth-state helpers. Overlays are handled with `waitFor`
 * conditions rather than `device.disableSynchronization()`, and errors are
 * detected from the screen rather than from a toast.
 */

import { element, by, waitFor, system, device } from 'detox';
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

export async function loginAsTestUser() {
  console.log(`🔐 Logging in as test user: ${TEST_USER.email}`);
  await loginWithCredentials(TEST_USER.email, TEST_USER.password);
  console.log('✅ Login successful');
}

export async function loginWithCredentials(email: string, password: string) {
  console.log(`🔐 Logging in with email: ${email}`);

  await waitForScreen('login-screen', TIMEOUTS.NETWORK);

  await typeIntoField('login-email-input', email, true);
  await typeIntoField('login-password-input', password, true);
  await tapByID('login-submit-button');

  console.log('⏳ Waiting for authentication...');

  await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

  // Still on the login screen means the login failed.
  try {
    await waitFor(element(by.id('login-screen')))
      .toBeVisible()
      .withTimeout(2000);

    console.error('❌ Login failed - still on login screen');
    throw new Error('Login failed: Invalid credentials or network error');
  } catch (error) {
    // Off the login screen: success, so let anything else through.
    if (error instanceof Error && error.message.includes('Login failed')) {
      throw error;
    }
  }

  // Which tab lands is not fixed, so either counts — but neither appearing means
  // the login did not complete, and this MUST throw rather than warn: returning
  // successfully would let every spec assert against whatever screen is up.
  try {
    await waitForScreen('shopping-list-screen', TIMEOUTS.NETWORK);
    console.log('✅ Reached home screen');
  } catch {
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

  await dismissBiometricPromptIfPresent();
}

/**
 * How long to give iOS's "Save Password?" alert. It only appears on the first
 * UI login of a fresh install, so on most runs this is simply waited out once.
 */
const SYSTEM_ALERT_TIMEOUT_MS = 3000;

/** Latched so the once-per-install alert is not waited for in every `beforeEach`. */
let systemPasswordAlertHandled = false;

/** Clear the prompts that can follow a login or onboarding, using `waitFor` conditions. */
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

  // iOS's "Save Password?" alert is a SYSTEM alert, outside the app's view tree,
  // so `by.id` / `by.text` cannot see it while it blocks every tap with "View is
  // not hittable at its visible point"; Detox's system matcher is the only thing
  // that reaches it. iOS-only: Android's factory THROWS on `by.system.label`
  // while BUILDING the matcher, before any promise exists, so no `.catch()` can
  // attach and the throw takes the whole suite down from `beforeEach`.
  if (!systemPasswordAlertHandled && device.getPlatform() === 'ios') {
    // Raced against a timer: `system.element(...).tap()` BLOCKS when no alert is
    // present — it does not throw, and `waitFor` is typed for a NativeElement so
    // it cannot bound this. Unbounded, it burns jest's 120s HOOK timeout and
    // every test reports "Exceeded timeout of 120000 ms for a hook".
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

  // The onboarding biometric setup screen, which only real devices reach.
  await waitIfPresent(
    element(by.id('biometric-setup-screen')),
    async () => {
      console.log('📱 Skipping onboarding biometric setup...');
      await tapByID('biometric-setup-skip');
      console.log('✅ Biometric setup skipped');
    },
    3000,
  );

  console.log('✅ All post-login flows handled');
}

export async function signUpWithCredentials(
  email: string,
  password: string,
  displayName: string,
) {
  console.log(`📝 Signing up new user: ${email}`);

  await waitForScreen('signup-screen', TIMEOUTS.DEFAULT);

  await typeIntoField('signup-email-input', email, true);
  await typeIntoField('signup-password-input', password, true);
  await typeIntoField('signup-name-input', displayName, true);
  await tapByID('signup-submit-button');

  console.log('⏳ Waiting for signup to complete...');

  await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

  // Success lands on either onboarding or the home screen.
  try {
    await waitForScreen('onboarding-screen', 5000);
    console.log('✅ Signup successful - onboarding screen shown');
  } catch {
    try {
      await waitForScreen('shopping-list-screen', 5000);
      console.log('✅ Signup successful - home screen shown');
    } catch {
      console.error('❌ Signup failed');
      throw new Error('Signup failed: Check credentials or network');
    }
  }
}

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

export async function navigateToSignup() {
  console.log('Navigating to signup...');
  await tapByID('login-signup-link');
  await waitForScreen('signup-screen', TIMEOUTS.DEFAULT);
}

export async function navigateToForgotPassword() {
  console.log('Navigating to forgot password...');
  await tapByID('login-forgot-password-link');
  await waitForScreen('forgot-password-screen', TIMEOUTS.DEFAULT);
}

export async function isLoggedIn(): Promise<boolean> {
  try {
    // The tab bar is only mounted once a home screen is reachable.
    await waitFor(element(by.id('tab-bar')))
      .toBeVisible()
      .withTimeout(2000);
    return true;
  } catch {
    return false;
  }
}

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

/** Clean session between suites, without reinstalling the app. */
export async function resetAppState() {
  console.log('🔄 Resetting app state...');

  await device.clearKeychain();
  await device.reloadReactNative();
  await delay(2000);

  console.log('✅ App state reset');
}

export interface BootstrapOptions {
  /**
   * Seed the pantry sort so list order is known before the first frame. Driving
   * the sort modal costs two round-trips and must wait for the control to exist
   * at all — it renders under `{!!stats && …}`. Note `recent` sorts newest-first
   * under `asc` (comparator inverted, `b - a`); the app's default is `recent`+`desc`.
   */
  pantrySort?: {
    option: 'name' | 'expiry' | 'quantity' | 'recent';
    direction: 'asc' | 'desc';
  };
}

/**
 * Injects tokens via `launchArgs` (~1s, against ~5-8s for a UI login), falling
 * back to a UI login if that does not land logged in.
 */
export async function bootstrapAuthenticatedSession(
  options: BootstrapOptions = {},
) {
  console.log('🚀 Bootstrapping authenticated session...');

  // Seeded on BOTH launch paths below. `reloadReactNative` keeps the original
  // launch args and the preference persists, so seeding once holds for the file.
  const preferenceArgs = options.pantrySort
    ? {
        detoxPantrySortOption: options.pantrySort.option,
        detoxPantrySortDirection: options.pantrySort.direction,
      }
    : {};

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

    await launchAppWithFabricWorkaround({
      newInstance: true,
      permissions: { notifications: 'YES', camera: 'YES' },
      launchArgs: preferenceArgs,
    });
  }

  const loggedIn = await isLoggedIn();

  if (loggedIn) {
    console.log('Already logged in, keeping session...');
  } else {
    console.log('Not logged in, creating new session...');
    await skipToLogin();
    await loginAsTestUser();
    await dismissBiometricPromptIfPresent();
  }

  // Settle on a known screen before handing back.
  try {
    await waitForScreen('shopping-list-screen', 3000);
  } catch {
    try {
      await waitForScreen('pantry-screen', 3000);
    } catch {
      await tapByID('tab-shoppinglist');
      await waitForScreen('shopping-list-screen', TIMEOUTS.DEFAULT);
    }
  }

  console.log('✅ Authenticated session ready');
}
