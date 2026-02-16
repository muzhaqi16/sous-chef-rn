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
