import { element, by, waitFor, device } from 'detox';
import { launchAppWithFabricWorkaround } from '../init';
import { LandingAuthScreen } from '../screens/LandingAuthScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { BiometricSetupScreen, CreateHomeScreen, CreateShoppingListScreen, SelectPantryItemsScreen } from '../screens/OnboardingScreens';
import { PantryScreen } from '../screens/PantryScreen';
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

  // Only appears on devices with biometric support.
  try {
    await biometricSetupScreen.waitForScreen(3000);
    await biometricSetupScreen.tapSkip();
  } catch {}
}

/**
 * Fresh install plus login. Injects tokens for speed and falls back to a UI
 * login when injection does not produce a logged-in state.
 */
export async function bootstrapFreshAuthenticatedSession() {
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

  await landingScreen.waitForScreen(5000);
  await landingScreen.tapLogin();
  await loginScreen.waitForScreen(5000);
  await loginScreen.loginAsTestUser();

  await skipOptionalOnboardingScreens();
  await pantryScreen.waitForScreen();
}

/**
 * Return the app to the pantry tab, whatever state the previous test left.
 * Reloads (closing every modal on both platforms), taps the tab, and throws if
 * `pantry-screen` never lands: a test that cannot reach its starting state has
 * to say so, or one real bug gets reported as nine failures.
 */
export async function relaunchToHomeTab() {
  const goToPantryTab = async () => {
    await waitFor(element(by.id('tab-pantry')))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.id('tab-pantry')).tap();
    await pantryScreen.waitForScreen(5000);
  };

  // Reload unconditionally: a sheet left open by a failing test does NOT hide
  // `pantry-screen` behind it, so an "am I already home?" probe passes while
  // the sheet still covers the tab-bar add button. Let the toast clear first —
  // `reloadReactNative` tears the runtime down under Fabric, and landing
  // mid-mounting-transaction SIGSEGVs in `uiManagerDidFinishTransaction`,
  // killing the rest of the file. Sync is off, so nothing waits on our behalf.
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
