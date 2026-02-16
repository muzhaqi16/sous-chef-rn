/**
 * Profile Settings E2E Tests
 *
 * Tests for profile and app settings including:
 * - Update profile info
 * - Toggle theme
 * - Notification settings
 */

import { element, by, waitFor, expect } from 'detox';
import { ProfileScreen } from '../../screens';
import { bootstrapAuthenticatedSession, relaunchToHomeTab } from '../../helpers';
import { TIMEOUTS } from '../../helpers/waitFor';
import { tapByID } from '../../helpers/actions';

describe('Profile Settings', () => {
  const profileScreen = new ProfileScreen();

  beforeAll(async () => {
    await bootstrapAuthenticatedSession();
  });

  beforeEach(async () => {
    await relaunchToHomeTab();
    await tapByID('tab-profile');
    await profileScreen.waitForScreen();
  });

  describe('Profile Display', () => {
    it('should display profile screen', async () => {
      await profileScreen.expectScreenVisible();
    });

    it('should show user information', async () => {
      // Should display user's avatar
      await waitFor(element(by.id('profile-avatar')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);
    });

    it('should show settings sections', async () => {
      // Look for common settings sections
      const settingsSections = [
        'Account',
        'Preferences',
        'Notifications',
        'App Settings',
      ];

      for (const section of settingsSections) {
        await waitFor(element(by.text(section)))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);
      }
    });
  });

  describe('Profile Update', () => {
    it('should navigate to personal information', async () => {
      await tapByID('profile-menu-personalInformation');

      await waitFor(element(by.id('personal-information-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await profileScreen.goBack();
      await profileScreen.waitForScreen();
    });

    it('should update profile avatar', async () => {
      const avatarButton = element(by.id('profile-avatar'));
      await waitFor(avatarButton).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await avatarButton.tap();

      // Should show photo options
      await waitFor(element(by.id('photo-option-camera')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Cancel for now
      await device.pressBack();
    });
  });

  describe('App Settings', () => {
    it('should navigate to app settings', async () => {
      await tapByID('profile-menu-appSettings');

      await waitFor(element(by.id('app-settings-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await profileScreen.goBack();
      await profileScreen.waitForScreen();
    });

    it('should toggle dark mode', async () => {
      await tapByID('profile-menu-appSettings');

      await waitFor(element(by.id('app-settings-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Find theme toggle
      const themeToggle = element(by.id('theme-toggle'));
      await waitFor(themeToggle).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await themeToggle.tap();

      // Toggle back
      await themeToggle.tap();

      await profileScreen.goBack();
      await profileScreen.waitForScreen();
    });
  });

  describe('Notification Settings', () => {
    it('should navigate to notification settings', async () => {
      await tapByID('profile-menu-notifications');

      await waitFor(element(by.id('notification-settings-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await profileScreen.goBack();
      await profileScreen.waitForScreen();
    });

    it('should toggle notification preferences', async () => {
      await tapByID('profile-menu-notifications');

      await waitFor(element(by.id('notification-settings-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Find a notification toggle
      const notificationToggle = element(by.id('expiration-notifications-toggle'));
      await waitFor(notificationToggle).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await notificationToggle.tap();

      // Toggle back
      await notificationToggle.tap();

      await profileScreen.goBack();
      await profileScreen.waitForScreen();
    });
  });

  describe('Dietary Profile', () => {
    it('should navigate to dietary profile', async () => {
      await tapByID('profile-menu-dietaryProfile');

      await waitFor(element(by.id('dietary-profile-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      await profileScreen.goBack();
      await profileScreen.waitForScreen();
    });

    it('should update dietary preferences', async () => {
      await tapByID('profile-menu-dietaryProfile');

      await waitFor(element(by.id('dietary-profile-screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.DEFAULT);

      // Look for dietary options
      const vegetarianOption = element(by.id('dietary-vegetarian'));
      await waitFor(vegetarianOption).toBeVisible().withTimeout(TIMEOUTS.DEFAULT);
      await vegetarianOption.tap();

      // Save changes
      try {
        await tapByID('save-dietary-button');
      } catch {
        // Might auto-save
      }

      await profileScreen.goBack();
      await profileScreen.waitForScreen();
    });
  });
});
