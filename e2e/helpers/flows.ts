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

  try {
    await biometricSetupScreen.waitForScreen(2000);
    await biometricSetupScreen.tapSkip();
  } catch {}
}

export async function bootstrapAuthenticatedSession() {
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
  // For app reuse: Just reload React Native instead of terminating app
  await device.reloadReactNative();

  // Wait for splash screen to disappear after reload
  await waitFor(element(by.id('splash-screen')))
    .not.toBeVisible()
    .withTimeout(10000);

  // Wait for app to initialize navigation (navigationState computation)
  await delay(2000);

  await dismissBiometricPromptIfPresent();

  // Navigate to pantry tab (might already be there)
  try {
    await element(by.id('tab-pantry')).tap();
  } catch {}

  await pantryScreen.waitForScreen(); // Uses default 5s timeout
}
