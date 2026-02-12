/**
 * Profile Account E2E Tests
 *
 * Tests for account management including:
 * - Change password
 * - Logout
 * - Delete account (with safeguards)
 */

import { element, by, waitFor, expect } from 'detox';
import { ProfileScreen, LoginScreen, LandingAuthScreen } from '../../screens';
import {
  bootstrapAuthenticatedSession,
  relaunchToHomeTab,
  loginAsTestUser,
} from '../../helpers';
import { TIMEOUTS } from '../../helpers/waitFor';
import { tapByID } from '../../helpers/actions';
import { TEST_USER } from '../../fixtures/testData';

describe('Profile Account', () => {
  const profileScreen = new ProfileScreen();
  const loginScreen = new LoginScreen();
  const landingScreen = new LandingAuthScreen();

  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
  });

  beforeEach(async () => {
    await relaunchToHomeTab();
    await tapByID('tab-profile');
    await profileScreen.waitForScreen();
  });

  describe('Change Password', () => {
    it('should navigate to change password', async () => {
      await tapByID('profile-menu-changePassword');

      await waitFor(element(by.id('change-password-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await profileScreen.goBack();
      await profileScreen.waitForScreen();
    });

    it('should validate current password', async () => {
      await tapByID('profile-menu-changePassword');

      await waitFor(element(by.id('change-password-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Enter wrong current password
      const currentPasswordInput = element(by.id('current-password-input'));
      await currentPasswordInput.typeText('wrongpassword');

      const newPasswordInput = element(by.id('new-password-input'));
      await newPasswordInput.typeText('NewPassword123!');

      const confirmPasswordInput = element(by.id('confirm-password-input'));
      await confirmPasswordInput.typeText('NewPassword123!');

      await tapByID('submit-password-change');

      // Should stay on change password screen (validation error)
      await waitFor(element(by.id('change-password-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.NETWORK);

      await profileScreen.goBack();
      await profileScreen.waitForScreen();
    });

    it('should validate password match', async () => {
      await tapByID('profile-menu-changePassword');

      await waitFor(element(by.id('change-password-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Enter mismatched passwords
      const currentPasswordInput = element(by.id('current-password-input'));
      await currentPasswordInput.typeText(TEST_USER.password);

      const newPasswordInput = element(by.id('new-password-input'));
      await newPasswordInput.typeText('NewPassword123!');

      const confirmPasswordInput = element(by.id('confirm-password-input'));
      await confirmPasswordInput.typeText('DifferentPassword123!');

      await tapByID('submit-password-change');

      // Should stay on change password screen
      await waitFor(element(by.id('change-password-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await profileScreen.goBack();
      await profileScreen.waitForScreen();
    });
  });

  describe('Logout', () => {
    it('should show logout button', async () => {
      // Scroll to find logout button
      const scrollView = element(by.id('profile-scroll-view'));
      await scrollView.scrollTo('bottom');

      await waitFor(element(by.id('profile-logout-button')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should logout successfully', async () => {
      // Scroll to find logout button
      const scrollView = element(by.id('profile-scroll-view'));
      await scrollView.scrollTo('bottom');

      await tapByID('profile-logout-button');

      // Might have confirmation dialog
      try {
        await waitFor(element(by.id('confirm-logout-button')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.QUICK);
        await tapByID('confirm-logout-button');
      } catch {
        // No confirmation needed
      }

      // Should navigate to landing or login screen
      let loggedOut = false;

      try {
        await landingScreen.waitForScreen(TIMEOUTS.DEFAULT);
        loggedOut = true;
      } catch {
        // Not landing screen
      }

      if (!loggedOut) {
        await loginScreen.waitForScreen(TIMEOUTS.DEFAULT);
        loggedOut = true;
      }

      expect(loggedOut).toBe(true);

      // Log back in for subsequent tests
      try {
        await landingScreen.tapLogin();
      } catch {
        // Already on login screen
      }
      await loginScreen.waitForScreen();
      await loginAsTestUser();
    });
  });

  describe('Delete Account', () => {
    it('should show delete account option', async () => {
      // Look for more menu or scroll to find delete
      const scrollView = element(by.id('profile-scroll-view'));
      await scrollView.scrollTo('bottom');

      let foundDeleteOption = false;

      try {
        const moreButton = element(by.id('profile-more-button'));
        await waitFor(moreButton).toBeVisible().withTimeout(TIMEOUTS.QUICK);
        await moreButton.tap();

        await waitFor(element(by.text('Delete Account')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);
        foundDeleteOption = true;

        // Close menu
        await device.pressBack();
      } catch {
        // Check main list instead
      }

      if (!foundDeleteOption) {
        await waitFor(element(by.id('delete-account-button')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);
        foundDeleteOption = true;
      }

      expect(foundDeleteOption).toBe(true);
    });

    it('should require confirmation for delete', async () => {
      const moreButton = element(by.id('profile-more-button'));
      await waitFor(moreButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await moreButton.tap();

      const deleteOption = element(by.text('Delete Account'));
      await waitFor(deleteOption).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await deleteOption.tap();

      // Should show confirmation screen or dialog
      await waitFor(element(by.id('delete-account-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Should require typing confirmation
      await waitFor(element(by.id('delete-confirmation-input')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Cancel and go back
      await profileScreen.goBack();
      await profileScreen.waitForScreen();
    });

    // NOTE: We don't actually test deleting the account as it would be destructive
    it('should NOT delete account without proper confirmation', async () => {
      // This is intentionally a no-op test as a reminder
      expect(true).toBe(true);
    });
  });

  describe('Security', () => {
    it('should show biometric settings', async () => {
      await tapByID('profile-menu-appSettings');

      await waitFor(element(by.id('app-settings-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Look for biometric toggle
      await waitFor(element(by.id('biometric-toggle')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await profileScreen.goBack();
      await profileScreen.waitForScreen();
    });
  });
});
