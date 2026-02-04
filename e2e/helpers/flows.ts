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
  // Dismiss any overlays first
  await dismissBiometricPromptIfPresent();

  // Wait for app to be ready
  await delay(500);

  // Try to navigate to pantry tab (home) to ensure consistent starting state
  try {
    await waitFor(element(by.id('tab-pantry')))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.id('tab-pantry')).tap();
    await pantryScreen.waitForScreen(5000);
  } catch {
    // Tab might already be visible, or we need to go back first
    try {
      // Press back to dismiss any modal/screen
      await device.pressBack();
      await delay(500);
      await waitFor(element(by.id('tab-pantry')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('tab-pantry')).tap();
    } catch {
      console.log('Could not navigate to pantry tab, continuing...');
    }
  }

  await delay(500);
}
