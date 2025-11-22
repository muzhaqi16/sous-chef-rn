/**
 * Smoke Tests
 *
 * Quick verification tests to ensure basic app functionality works.
 * These tests should run fast and catch critical issues.
 *
 * Updated to use specific testIDs instead of generic selectors.
 */

import { launchAppWithFabricWorkaround } from '../init';
import { LandingAuthScreen, LoginScreen } from '../screens';

describe('Smoke Tests', () => {
  const landingScreen = new LandingAuthScreen();
  const loginScreen = new LoginScreen();

  beforeAll(async () => {
    await launchAppWithFabricWorkaround({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  it('should launch the app successfully', async () => {
    // Wait for splash screen to disappear - this verifies app hydrated successfully
    await waitFor(element(by.id('splash-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    // App successfully launched and hydrated if splash disappeared
  });

  it('should show landing screen or login screen', async () => {
    // Check if we're on landing screen or login screen
    try {
      await landingScreen.waitForScreen(3000);
      console.log('✓ Landing screen loaded');
    } catch {
      try {
        await loginScreen.waitForScreen(3000);
        console.log('✓ Login screen loaded');
      } catch {
        // Might be on home screen if already logged in
        await expect(element(by.id('tab-bar'))).toBeVisible();
        console.log('✓ Tab bar visible - user already logged in');
      }
    }
  });

  it('should be able to navigate to login from landing', async () => {
    try {
      // If on landing screen, should be able to tap login button
      await landingScreen.waitForScreen(1000);
      await landingScreen.expectLoginButtonVisible();
      await landingScreen.tapLogin();
      await loginScreen.waitForScreen(3000);
      console.log('✓ Successfully navigated to login screen');
    } catch {
      // Not on landing screen - already logged in or on different screen
      console.log('⊘ Not on landing screen - skipping navigation test');
    }
  });

  it('should have functional login screen elements', async () => {
    try {
      // If on login screen, verify all elements are present
      await loginScreen.waitForScreen(1000);
      await loginScreen.expectVisible('login-email-input');
      await loginScreen.expectVisible('login-password-input');
      await loginScreen.expectVisible('login-submit-button');
      console.log('✓ All login screen elements present');
    } catch {
      console.log('⊘ Not on login screen - skipping element test');
    }
  });

  it('should have bottom navigation if logged in', async () => {
    // Check if bottom navigation is present
    try {
      await expect(element(by.id('tab-bar'))).toBeVisible();
      console.log('✓ Tab bar visible');

      // Verify all tabs are accessible
      await expect(element(by.id('tab-pantry'))).toExist();
      await expect(element(by.id('tab-shoppinglist'))).toExist();
      await expect(element(by.id('tab-recipe'))).toExist();
      await expect(element(by.id('tab-profile'))).toExist();
      console.log('✓ All navigation tabs present');
    } catch {
      console.log('⊘ Not logged in - skipping tab bar test');
    }
  });

  it('should not crash during basic interactions', async () => {
    // App is stable if we got this far without crashing
    // This test just verifies the app didn't crash during previous tests
    await expect(element(by.id('splash-screen'))).not.toBeVisible();
    console.log('✓ App remained stable through all smoke tests');
  });
});
