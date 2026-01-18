import { element, by, waitFor } from 'detox';
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
import { dismissBiometricPromptIfPresent } from './auth';
import { delay } from './waitFor';

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
  // Emulators don't have biometrics, so use very short timeout
  try {
    await biometricSetupScreen.waitForScreen(500);
    await biometricSetupScreen.tapSkip();
  } catch {}
}

/**
 * Bootstrap fresh authenticated session with clean app state
 * Use this when you need a completely fresh app install + login
 */
export async function bootstrapFreshAuthenticatedSession() {
  await launchAppWithFabricWorkaround({
    newInstance: true,
    delete: true,
    permissions: { notifications: 'YES', camera: 'YES' },
  });

  await landingScreen.waitForScreen(5000);
  await landingScreen.tapLogin();
  await loginScreen.waitForScreen(5000);
  await loginScreen.loginAsTestUser();

  await skipOptionalOnboardingScreens();
  await pantryScreen.waitForScreen(); // Uses default 5s timeout
}

export async function relaunchToHomeTab() {
  // Use launchApp with newInstance: false to reuse app without full reload
  // This is more reliable than reloadReactNative() which can lose connection
  try {
    await device.launchApp({ newInstance: false });
  } catch {
    // If app launch fails, try reloading React Native as fallback
    try {
      await device.reloadReactNative();
    } catch {
      // Last resort: launch fresh instance
      await device.launchApp({ newInstance: true });
    }
  }

  // Wait for splash screen to disappear after reload
  try {
    await waitFor(element(by.id('splash-screen')))
      .not.toBeVisible()
      .withTimeout(5000);
  } catch {
    // Splash screen might not appear for app reuse
  }

  // Wait for app to initialize navigation (navigationState computation)
  await delay(1000);

  await dismissBiometricPromptIfPresent();

  // Wait for tab bar to be visible (indicates app is ready for navigation)
  try {
    await waitFor(element(by.id('tab-bar')))
      .toBeVisible()
      .withTimeout(10000);
  } catch {
    // Tab bar might have different ID or already visible
  }
}
