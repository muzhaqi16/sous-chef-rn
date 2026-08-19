import { element, by, waitFor, device } from 'detox';
import { launchAppWithFabricWorkaround } from '../init';
import {
  LandingAuthScreen,
  LoginScreen,
  PantryScreen,
  CreateHomeScreen,
  CreateShoppingListScreen,
  SelectPantryItemsScreen,
  BiometricSetupScreen,
} from '../screens';
import { dismissBiometricPromptIfPresent, isLoggedIn } from './auth';
import { delay } from './waitFor';
import { getAuthTokens } from './tokenProvider';

const landingScreen = new LandingAuthScreen();
const loginScreen = new LoginScreen();
const pantryScreen = new PantryScreen();
const createHomeScreen = new CreateHomeScreen();
const createShoppingListScreen = new CreateShoppingListScreen();
const selectPantryItemsScreen = new SelectPantryItemsScreen();
const biometricSetupScreen = new BiometricSetupScreen();

async function skipOptionalOnboardingScreens() {
  await dismissBiometricPromptIfPresent();

  try {
    await createHomeScreen.waitForScreen(2000);
    await createHomeScreen.tapSkip();
  } catch {
    console.log('CreateHome screen not present, skipping...');
  }

  try {
    await createShoppingListScreen.waitForScreen(2000);
    await createShoppingListScreen.tapSkip();
  } catch {}

  try {
    await selectPantryItemsScreen.waitForScreen(2000);
    await selectPantryItemsScreen.tapSkip();
  } catch {}

  // NOTE: Biometric setup only appears on devices with biometric support
  // Use 3s timeout to allow for real device delays
  try {
    await biometricSetupScreen.waitForScreen(3000);
    await biometricSetupScreen.tapSkip();
  } catch {}
}

/**
 * Bootstrap fresh authenticated session with clean app state
 * Use this when you need a completely fresh app install + login.
 * Uses token injection for speed, falls back to UI login.
 */
export async function bootstrapFreshAuthenticatedSession() {
  // Try token injection first (fast path)
  try {
    const tokens = await getAuthTokens();
    console.log('🔑 Launching fresh app with injected auth tokens...');

    await launchAppWithFabricWorkaround({
      newInstance: true,
      delete: true,
      permissions: { notifications: 'YES', camera: 'YES' },
      launchArgs: {
        detoxUserToken: tokens.accessToken,
        detoxRefreshToken: tokens.refreshToken,
        detoxUser: JSON.stringify(tokens.user),
      },
    });

    const loggedIn = await isLoggedIn();
    if (loggedIn) {
      console.log('✅ Token injection successful (fresh session)');
      await skipOptionalOnboardingScreens();
      await pantryScreen.waitForScreen();
      return;
    }

    console.log('⚠️ Token injection did not result in logged-in state, falling back to UI login...');
  } catch (error) {
    console.log(`⚠️ Token injection failed: ${error}, falling back to UI login...`);

    await launchAppWithFabricWorkaround({
      newInstance: true,
      delete: true,
      permissions: { notifications: 'YES', camera: 'YES' },
    });
  }

  // Fallback: UI login
  await landingScreen.waitForScreen(5000);
  await landingScreen.tapLogin();
  await loginScreen.waitForScreen(5000);
  await loginScreen.loginAsTestUser();

  await skipOptionalOnboardingScreens();
  await pantryScreen.waitForScreen();
}

/**
 * Return the app to the pantry tab, whatever state the previous test left.
 *
 * The name always promised a relaunch; it used to only tap the tab, which a
 * modal sheet blocks. One test that failed with the "Add Item Details" sheet
 * open therefore poisoned every test after it: each `beforeEach` timed out on
 * `pantry-screen`, and nine failures reported one bug.
 *
 * The old fallback used `device.pressBack()` — Android-only, and it throws on
 * iOS — then swallowed that and logged "continuing...", so the suite carried on
 * from a state it had failed to establish.
 *
 * Now: tap the tab; if that does not land, reload React Native (which closes
 * every modal on both platforms) and try once more; if THAT does not land,
 * throw. A test that cannot reach its starting state has to say so — silently
 * continuing is what turned one failure into nine.
 */
export async function relaunchToHomeTab() {
  const goToPantryTab = async () => {
    await waitFor(element(by.id('tab-pantry')))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.id('tab-pantry')).tap();
    await pantryScreen.waitForScreen(5000);
  };

  // Reload unconditionally rather than probing first. Probing does not work:
  // a bottom sheet left open by a failing test does NOT hide `pantry-screen`
  // behind it, so the "am I already home?" check passes, the sheet stays up,
  // and the next test fails on the tab-bar add button it covers. Detecting
  // "some modal is open" would mean enumerating every sheet in the app and
  // keeping that list current — a reload is one call and cannot miss one.
  //
  // ~2s per test, which is cheaper than a false failure: the previous version
  // turned one real bug into nine reports.
  // Let the previous test's work finish before tearing down the JS runtime.
  //
  // `reloadReactNative` destroys the runtime underneath Fabric. If a mounting
  // transaction is still in flight when it lands, the app takes SIGSEGV inside
  // `Scheduler::uiManagerDidFinishTransaction` and Detox reports
  // `The pending request ("reactNativeReload") has been rejected` — followed by
  // every remaining test in the file failing in a few hundred ms against a dead
  // app. It looked like flake because WHICH test died depended on what the one
  // before it left running; in practice it was always the swipe tests, which
  // leave the most in flight (row-removal animation, FlashList re-layout, and
  // the confirmation toast).
  //
  // Detox would normally hold the reload until the app went idle, but this suite
  // launches with `detoxEnableSynchronization: 0` (see
  // `launchAppWithFabricWorkaround` — Fabric keeps the run loop busy, so sync
  // never settles), which means nothing is waiting on our behalf. Waiting for
  // the toast to clear covers the animation that actually overlaps the reload;
  // the short delay after it covers the list's own removal animation.
  try {
    await waitFor(element(by.id('toast-success')))
      .not.toBeVisible()
      .withTimeout(6000);
  } catch {
    // Never rendered, or still up — neither is a reason to fail a reload.
  }
  await delay(500);

  await device.reloadReactNative();
  await dismissBiometricPromptIfPresent();
  await delay(500);
  await goToPantryTab();
}
