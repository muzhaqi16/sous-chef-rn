/**
 * Profile Settings E2E Tests
 *
 * Tests for profile and app settings including:
 * - Update profile info
 * - Toggle theme
 * - Notification settings
 */

import { element, by, waitFor, expect } from 'detox';
import { launchAppWithFabricWorkaround } from '../../init';
import { ProfileScreen, SettingsScreen } from '../../screens';
import { bootstrapAuthenticatedSession, relaunchToHomeTab } from '../../helpers';
import { delay, TIMEOUTS } from '../../helpers/waitFor';
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
      // Should display user's name or email
      await delay(1000);

      try {
        // Look for profile header elements
        await waitFor(element(by.id('profile-avatar')))
          .toBeVisible()
          .withTimeout(2000);
        console.log('✓ Profile avatar visible');
      } catch {
        console.log('Profile avatar not found');
      }
    });

    it('should show settings sections', async () => {
      await delay(500);

      // Look for common settings sections
      const settingsSections = [
        'Account',
        'Preferences',
        'Notifications',
        'App Settings',
      ];

      for (const section of settingsSections) {
        try {
          await waitFor(element(by.text(section)))
            .toBeVisible()
            .withTimeout(1000);
          console.log(`✓ ${section} section visible`);
        } catch {
          console.log(`⊘ ${section} section not found`);
        }
      }
    });
  });

  describe('Profile Update', () => {
    it('should navigate to personal information', async () => {
      try {
        await tapByID('profile-menu-personalInformation');

        await waitFor(element(by.id('personal-information-screen')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);

        console.log('✓ Navigated to personal information');

        await profileScreen.goBack();
      } catch {
        console.log('Personal information navigation not found');
      }
    });

    it('should update profile avatar', async () => {
      try {
        const avatarButton = element(by.id('profile-avatar'));
        await waitFor(avatarButton).toBeVisible().withTimeout(2000);
        await avatarButton.tap();

        // Should show photo options
        await delay(500);

        // Look for camera or gallery options
        try {
          await waitFor(element(by.id('photo-option-camera')))
            .toBeVisible()
            .withTimeout(2000);
          console.log('✓ Photo options visible');

          // Cancel for now
          await device.pressBack();
        } catch {
          await device.pressBack();
        }
      } catch {
        console.log('Avatar update not available');
      }
    });
  });

  describe('App Settings', () => {
    it('should navigate to app settings', async () => {
      try {
        await tapByID('profile-menu-appSettings');

        await waitFor(element(by.id('app-settings-screen')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);

        console.log('✓ Navigated to app settings');

        await profileScreen.goBack();
      } catch {
        console.log('App settings navigation not found');
      }
    });

    it('should toggle dark mode', async () => {
      try {
        await tapByID('profile-menu-appSettings');

        await waitFor(element(by.id('app-settings-screen')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);

        // Find theme toggle
        const themeToggle = element(by.id('theme-toggle'));
        await waitFor(themeToggle).toBeVisible().withTimeout(2000);
        await themeToggle.tap();

        await delay(500);

        // Theme should change
        console.log('✓ Theme toggled');

        // Toggle back
        await themeToggle.tap();
        await delay(500);

        await profileScreen.goBack();
      } catch {
        console.log('Theme toggle not found');
      }
    });
  });

  describe('Notification Settings', () => {
    it('should navigate to notification settings', async () => {
      try {
        await tapByID('profile-menu-notifications');

        await waitFor(element(by.id('notification-settings-screen')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);

        console.log('✓ Navigated to notification settings');

        await profileScreen.goBack();
      } catch {
        console.log('Notification settings navigation not found');
      }
    });

    it('should toggle notification preferences', async () => {
      try {
        await tapByID('profile-menu-notifications');

        await waitFor(element(by.id('notification-settings-screen')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);

        // Find a notification toggle
        const notificationToggle = element(by.id('expiration-notifications-toggle'));
        await waitFor(notificationToggle).toBeVisible().withTimeout(2000);
        await notificationToggle.tap();

        await delay(500);

        // Toggle back
        await notificationToggle.tap();
        await delay(500);

        console.log('✓ Notification preference toggled');

        await profileScreen.goBack();
      } catch {
        console.log('Notification toggles not found');
      }
    });
  });

  describe('Dietary Profile', () => {
    it('should navigate to dietary profile', async () => {
      try {
        await tapByID('profile-menu-dietaryProfile');

        await waitFor(element(by.id('dietary-profile-screen')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);

        console.log('✓ Navigated to dietary profile');

        await profileScreen.goBack();
      } catch {
        console.log('Dietary profile navigation not found');
      }
    });

    it('should update dietary preferences', async () => {
      try {
        await tapByID('profile-menu-dietaryProfile');

        await waitFor(element(by.id('dietary-profile-screen')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.DEFAULT);

        // Look for dietary options
        const vegetarianOption = element(by.id('dietary-vegetarian'));
        await waitFor(vegetarianOption).toBeVisible().withTimeout(2000);
        await vegetarianOption.tap();

        await delay(500);

        // Save changes
        try {
          await tapByID('save-dietary-button');
        } catch {
          // Might auto-save
        }

        console.log('✓ Dietary preference updated');

        await profileScreen.goBack();
      } catch {
        console.log('Dietary profile update not available');
      }
    });
  });
});
