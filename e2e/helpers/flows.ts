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
  await device.reloadReactNative();
  await dismissBiometricPromptIfPresent();
  await delay(500);
  await goToPantryTab();
}
