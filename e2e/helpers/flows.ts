import { element, by } from 'detox';
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
  } catch {}

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
  await pantryScreen.waitForScreen(10000);
}

export async function relaunchToHomeTab() {
  await launchAppWithFabricWorkaround({
    newInstance: false,
    permissions: { notifications: 'YES', camera: 'YES' },
  });

  await dismissBiometricPromptIfPresent();

  try {
    await element(by.id('tab-pantry')).tap();
  } catch {}

  await pantryScreen.waitForScreen(10000);
}
