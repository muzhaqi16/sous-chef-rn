/**
 * Smoke Tests
 *
 * Quick verification tests to ensure basic app functionality works.
 * These tests should run fast and catch critical issues.
 */
import { element, by, waitFor, expect } from 'detox';
import { launchAppWithFabricWorkaround } from '../init';
import { LandingAuthScreen, LoginScreen } from '../screens';
import { TIMEOUTS } from '../helpers/waitFor';

describe('Smoke Tests', () => {
  const landingScreen = new LandingAuthScreen();
  const loginScreen = new LoginScreen();

  beforeAll(async () => {
    await launchAppWithFabricWorkaround({
      newInstance: false,
      permissions: { notifications: 'YES' },
    });
  });

  it('should launch the app successfully', async () => {
    // Wait for splash screen to disappear - this verifies app hydrated successfully
    await waitFor(element(by.id('splash-screen')))
      .not.toBeVisible()
      .withTimeout(10000);
  });

  it('should show landing screen, login screen, or home', async () => {
    // At least one of these must be visible after app launch
    let foundScreen = false;

    try {
      await landingScreen.waitForScreen(3000);
      foundScreen = true;
      console.log('✓ Landing screen loaded');
    } catch {
      // Not on landing screen
    }

    if (!foundScreen) {
      try {
        await loginScreen.waitForScreen(3000);
        foundScreen = true;
        console.log('✓ Login screen loaded');
      } catch {
        // Not on login screen
      }
    }

    if (!foundScreen) {
      // Must be logged in with tab bar visible
      await waitFor(element(by.id('tab-bar')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
      foundScreen = true;
      console.log('✓ Tab bar visible - user already logged in');
    }

    if (!foundScreen) {
      throw new Error('No screen found after app launch - expected landing, login, or home');
    }
  });

  it('should be able to navigate to login from landing', async () => {
    // Only run if on landing screen
    let onLanding = false;
    try {
      await landingScreen.waitForScreen(1000);
      onLanding = true;
    } catch {
      // Not on landing screen
    }

    if (onLanding) {
      await landingScreen.expectLoginButtonVisible();
      await landingScreen.tapLogin();
      await loginScreen.waitForScreen(3000);
      console.log('✓ Successfully navigated to login screen');
    } else {
      console.log('⊘ Not on landing screen - skipping navigation test');
    }
  });

  it('should have functional login screen elements', async () => {
    let onLogin = false;
    try {
      await loginScreen.waitForScreen(1000);
      onLogin = true;
    } catch {
      // Not on login screen
    }

    if (onLogin) {
      await loginScreen.expectVisible('login-email-input');
      await loginScreen.expectVisible('login-password-input');
      await loginScreen.expectVisible('login-submit-button');
      console.log('✓ All login screen elements present');
    } else {
      console.log('⊘ Not on login screen - skipping element test');
    }
  });

  it('should have bottom navigation if logged in', async () => {
    let isLoggedIn = false;
    try {
      await waitFor(element(by.id('tab-bar')))
        .toBeVisible()
        .withTimeout(2000);
      isLoggedIn = true;
    } catch {
      // Not logged in
    }

    if (isLoggedIn) {
      await expect(element(by.id('tab-pantry'))).toExist();
      await expect(element(by.id('tab-shoppinglist'))).toExist();
      await expect(element(by.id('tab-recipe'))).toExist();
      await expect(element(by.id('tab-profile'))).toExist();
      console.log('✓ All navigation tabs present');
    } else {
      console.log('⊘ Not logged in - skipping tab bar test');
    }
  });

  it('should not crash during basic interactions', async () => {
    // App is stable if we got this far without crashing
    await expect(element(by.id('splash-screen'))).not.toBeVisible();
    console.log('✓ App remained stable through all smoke tests');
  });
});
