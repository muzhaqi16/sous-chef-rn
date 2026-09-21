/**
 * Login/logout and auth-state helpers. Overlays are handled with `waitFor`
 * conditions rather than `device.disableSynchronization()`, and errors are
 * detected from the screen rather than from a toast.
 */

import { element, by, waitFor, system, device } from 'detox';
import {
  waitForScreen,
  waitIfPresent,
  waitForNetworkIdle,
  delay,
  TIMEOUTS,
} from './waitFor';
import { typeIntoField, tapByID } from './actions';
import { TEST_USER } from '../fixtures/testData';
import { launchAppWithFabricWorkaround } from '../init';
import { ApiUnreachableError, getAuthTokens } from './tokenProvider';
import { authTestIDs } from '../../src/features/auth/testIDs';
import { onboardingTestIDs } from '../../src/features/onboarding/testIDs';
import { pantryTestIDs } from '../../src/features/pantry/testIDs';
import { shoppingListTestIDs } from '../../src/features/shoppingList/testIDs';
import { kitTestIDs } from '../../src/components/testIDs';

export async function loginAsTestUser() {
  console.log(`🔐 Logging in as test user: ${TEST_USER.email}`);
  await loginWithCredentials(TEST_USER.email, TEST_USER.password);
  console.log('✅ Login successful');
}

export async function loginWithCredentials(email: string, password: string) {
  console.log(`🔐 Logging in with email: ${email}`);

  await waitForScreen(authTestIDs.loginScreen, TIMEOUTS.NETWORK);

  await typeIntoField(authTestIDs.loginEmailInput, email, true);
  await typeIntoField(authTestIDs.loginPasswordInput, password, true);
  await tapByID(authTestIDs.loginSubmitButton);

  console.log('⏳ Waiting for authentication...');

  await waitForNetworkIdle(undefined, TIMEOUTS.NETWORK);

  // Still on the login screen means the login failed.
  try {
    await waitFor(element(by.id(authTestIDs.loginScreen)))
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
    await waitForScreen(shoppingListTestIDs.screen, TIMEOUTS.NETWORK);
    console.log('✅ Reached home screen');
  } catch {
    try {
      await waitForScreen(pantryTestIDs.screen, TIMEOUTS.NETWORK);
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
    element(by.id(authTestIDs.rememberMeModal)),
    async () => {
      console.log('📱 Dismissing remember-login-info prompt...');
      await tapByID(authTestIDs.rememberMeDeclineButton);
      console.log('✅ Remember-login prompt dismissed');
    },
    3000,
  );

  // iOS's "Save Password?" alert is a SYSTEM alert, outside the app's view tree,
  // so no `by.*` matcher can see it while it blocks every tap with "View is
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

  // The post-login biometric offer, shown after a password login on any device
  // with biometrics enrolled and nothing stored for the account.
  await waitIfPresent(
    element(by.id(authTestIDs.postLoginBiometricScreen)),
    async () => {
      console.log('📱 Skipping post-login biometric setup...');
      await tapByID(kitTestIDs.biometricSkip(authTestIDs.postLoginBiometricView));
      console.log('✅ Post-login biometric setup skipped');
    },
    3000,
  );

  // The onboarding biometric setup screen, which only real devices reach.
  await waitIfPresent(
    element(by.id(onboardingTestIDs.biometricSetupScreen)),
    async () => {
      console.log('📱 Skipping onboarding biometric setup...');
      await tapByID(
        kitTestIDs.biometricSkip(onboardingTestIDs.biometricSetupView),
      );
      console.log('✅ Biometric setup skipped');
    },
    3000,
  );

  console.log('✅ All post-login flows handled');
}

export async function skipToLogin() {
  await waitIfPresent(
    element(by.id(authTestIDs.landingLoginButton)),
    async () => {
      console.log('Navigating to login from landing screen...');
      await tapByID(authTestIDs.landingLoginButton);
      await waitForScreen(authTestIDs.loginScreen, TIMEOUTS.DEFAULT);
    },
    5000, // Increased timeout to account for splash screen
  );
}

export async function navigateToSignup() {
  console.log('Navigating to signup...');
  await tapByID(authTestIDs.loginSignUpLink);
  await waitForScreen(authTestIDs.signUpScreen, TIMEOUTS.DEFAULT);
}

export async function navigateToForgotPassword() {
  console.log('Navigating to forgot password...');
  await tapByID(authTestIDs.loginForgotPasswordLink);
  await waitForScreen(authTestIDs.forgotPasswordScreen, TIMEOUTS.DEFAULT);
}

export async function isLoggedIn(): Promise<boolean> {
  try {
    // The tab bar is only mounted once a home screen is reachable.
    await waitFor(element(by.id(kitTestIDs.tabBar)))
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
    // missing login screen.
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
    await waitForScreen(shoppingListTestIDs.screen, 3000);
  } catch {
    try {
      await waitForScreen(pantryTestIDs.screen, 3000);
    } catch {
      await tapByID(kitTestIDs.tab('ShoppingList'));
      await waitForScreen(shoppingListTestIDs.screen, TIMEOUTS.DEFAULT);
    }
  }

  console.log('✅ Authenticated session ready');
}
