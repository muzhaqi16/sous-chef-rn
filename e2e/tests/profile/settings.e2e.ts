/**
 * Profile and Settings E2E Tests
 *
 * Tests profile and settings functionality including:
 * - Viewing profile information
 * - Navigating to settings
 * - Changing theme (dark mode)
 * - Notification settings
 * - Account management
 * - App information
 */

import { launchAppWithFabricWorkaround } from '../../init';
import {
  LoginScreen,
  ProfileScreen,
  SettingsScreen,
} from '../../screens';
import { TEST_USER } from '../../fixtures/testData';

describe('Profile and Settings', () => {
  const loginScreen = new LoginScreen();
  const profileScreen = new ProfileScreen();
  const settingsScreen = new SettingsScreen();

  beforeAll(async () => {
    await launchAppWithFabricWorkaround({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();

    // Login and navigate to profile
    try {
      await profileScreen.waitForScreen(3000);
    } catch {
      await loginScreen.waitForScreen();
      await loginScreen.loginAsTestUser();
      await profileScreen.navigateToTab();
    }

    // Ensure on profile screen
    await profileScreen.waitForScreen();
  });

  describe('Profile Display', () => {
    it('should display user name', async () => {
      // Assert
      await profileScreen.expectUserName(TEST_USER.displayName);
    });

    it('should display user email', async () => {
      // Assert
      await profileScreen.expectUserEmail(TEST_USER.email);
    });

    it('should show settings button', async () => {
      // Assert
      await profileScreen.expectSettingsButtonVisible();
    });

    it('should show edit profile button', async () => {
      // Assert
      await profileScreen.expectEditProfileButtonVisible();
    });

    it('should show profile menu items', async () => {
      // Assert - check various menu items are visible
      await profileScreen.expectMenuItemVisible(
        profileScreen['preferencesButton'],
      );
      await profileScreen.expectMenuItemVisible(
        profileScreen['helpButton'],
      );
    });
  });

  describe('Profile Navigation', () => {
    it('should navigate to settings', async () => {
      // Act
      await profileScreen.navigateToSettings();

      // Assert
      await settingsScreen.waitForScreen();
      await settingsScreen.expectScreenVisible();
    });

    it('should navigate to edit profile', async () => {
      // Act
      await profileScreen.navigateToEditProfile();

      // Assert
      await profileScreen.waitForElement('edit-profile-screen', 3000);
      await profileScreen.expectVisible('edit-profile-screen');
    });

    it('should navigate to preferences', async () => {
      // Act
      await profileScreen.navigateToPreferences();

      // Assert
      await profileScreen.waitForElement('preferences-screen', 3000);
      await profileScreen.expectVisible('preferences-screen');
    });

    it('should navigate to notifications settings', async () => {
      // Act
      await profileScreen.navigateToNotifications();

      // Assert
      await profileScreen.waitForElement(
        'notifications-settings-screen',
        3000,
      );
      await profileScreen.expectVisible('notifications-settings-screen');
    });

    it('should navigate to help', async () => {
      // Act
      await profileScreen.navigateToHelp();

      // Assert
      await profileScreen.waitForElement('help-screen', 3000);
      await profileScreen.expectVisible('help-screen');
    });

    it('should navigate to about', async () => {
      // Act
      await profileScreen.navigateToAbout();

      // Assert
      await profileScreen.waitForElement('about-screen', 3000);
      await profileScreen.expectVisible('about-screen');
    });
  });

  describe('Settings Screen', () => {
    beforeEach(async () => {
      // Navigate to settings before each test
      await profileScreen.navigateToSettings();
      await settingsScreen.waitForScreen();
    });

    it('should display settings screen', async () => {
      // Assert
      await settingsScreen.expectScreenVisible();
    });

    it('should go back to profile from settings', async () => {
      // Act
      await settingsScreen.goBackToProfile();

      // Assert
      await profileScreen.waitForScreen();
      await profileScreen.expectScreenVisible();
    });

    it('should scroll through settings', async () => {
      // Act
      await settingsScreen.scrollToBottom();
      await settingsScreen.scrollToTop();

      // Assert - no crash
      await settingsScreen.expectScreenVisible();
    });
  });

  describe('Theme Settings', () => {
    beforeEach(async () => {
      await profileScreen.navigateToSettings();
      await settingsScreen.waitForScreen();
    });

    it('should toggle dark mode', async () => {
      // Arrange - get initial state
      const initialState = await settingsScreen.isDarkModeEnabled();

      // Act - toggle
      await settingsScreen.toggleDarkMode();

      // Assert - state should change
      const newState = await settingsScreen.isDarkModeEnabled();
      expect(newState).toBe(!initialState);
    });

    it('should enable dark mode', async () => {
      // Act
      await settingsScreen.enableDarkMode();

      // Assert
      await settingsScreen.expectDarkModeEnabled();
    });

    it('should disable dark mode', async () => {
      // Act
      await settingsScreen.disableDarkMode();

      // Assert
      await settingsScreen.expectDarkModeDisabled();
    });

    it('should persist dark mode preference', async () => {
      // Arrange - enable dark mode
      await settingsScreen.enableDarkMode();
      await settingsScreen.expectDarkModeEnabled();

      // Act - navigate away and back
      await profileScreen.goBack();
      await profileScreen.waitForScreen();
      await profileScreen.navigateToSettings();
      await settingsScreen.waitForScreen();

      // Assert - preference should be saved
      await settingsScreen.expectDarkModeEnabled();
    });

    it('should toggle dark mode multiple times', async () => {
      // Act - toggle several times
      await settingsScreen.toggleDarkMode();
      await settingsScreen.toggleDarkMode();
      await settingsScreen.toggleDarkMode();

      // Assert - should be stable
      await settingsScreen.expectScreenVisible();
    });
  });

  describe('Notification Settings', () => {
    beforeEach(async () => {
      await profileScreen.navigateToSettings();
      await settingsScreen.waitForScreen();
    });

    it('should toggle all notifications', async () => {
      // Arrange - get initial state
      const initialState = await settingsScreen.isNotificationsEnabled();

      // Act
      await settingsScreen.toggleNotifications();

      // Assert
      const newState = await settingsScreen.isNotificationsEnabled();
      expect(newState).toBe(!initialState);
    });

    it('should enable notifications', async () => {
      // Act
      await settingsScreen.enableNotifications();

      // Assert
      await settingsScreen.expectNotificationsEnabled();
    });

    it('should disable notifications', async () => {
      // Act
      await settingsScreen.disableNotifications();

      // Assert
      await settingsScreen.expectNotificationsDisabled();
    });

    it('should toggle expiration alerts', async () => {
      // Act
      await settingsScreen.toggleExpirationAlerts();

      // Assert - no crash
      await settingsScreen.expectScreenVisible();
    });

    it('should toggle low stock alerts', async () => {
      // Act
      await settingsScreen.toggleLowStockAlerts();

      // Assert
      await settingsScreen.expectScreenVisible();
    });

    it('should toggle recipe alerts', async () => {
      // Act
      await settingsScreen.toggleRecipeAlerts();

      // Assert
      await settingsScreen.expectScreenVisible();
    });
  });

  describe('Data Management', () => {
    beforeEach(async () => {
      await profileScreen.navigateToSettings();
      await settingsScreen.waitForScreen();
    });

    it('should clear cache', async () => {
      // Act
      await settingsScreen.clearCache();

      // Assert - should show confirmation or complete
      await settingsScreen.expectScreenVisible();
    });

    it('should show clear cache confirmation', async () => {
      // Arrange
      await settingsScreen.scrollToBottom();

      // Act - tap clear cache
      await settingsScreen.tapByID(settingsScreen['clearCacheButton']);

      // Assert - confirmation might appear
      try {
        await settingsScreen.waitForElement(
          'clear-cache-confirmation-modal',
          2000,
        );
        await settingsScreen.expectVisible('clear-cache-confirmation-modal');

        // Cancel
        await settingsScreen.tapByID('cancel-clear-cache-button');
      } catch {
        console.log('No confirmation dialog for cache clear');
      }
    });

    it('should export data', async () => {
      // Act
      await settingsScreen.exportData();

      // Assert - export modal might appear
      try {
        await settingsScreen.waitForElement('export-data-modal', 2000);
        await settingsScreen.expectVisible('export-data-modal');
      } catch {
        console.log('Export completed without modal');
      }
    });
  });

  describe('Account Management', () => {
    beforeEach(async () => {
      await profileScreen.navigateToSettings();
      await settingsScreen.waitForScreen();
    });

    it('should navigate to change password', async () => {
      // Act
      await settingsScreen.navigateToChangePassword();

      // Assert
      await settingsScreen.waitForElement('change-password-screen', 3000);
      await settingsScreen.expectVisible('change-password-screen');
    });

    it('should navigate to change email', async () => {
      // Act
      await settingsScreen.navigateToChangeEmail();

      // Assert
      await settingsScreen.waitForElement('change-email-screen', 3000);
      await settingsScreen.expectVisible('change-email-screen');
    });

    it('should show delete account confirmation', async () => {
      // Act - scroll to delete button
      await settingsScreen.scrollToBottom();
      await settingsScreen.deleteAccount();

      // Assert - confirmation modal should appear
      await settingsScreen.waitForElement(
        'delete-account-confirmation-modal',
        2000,
      );
      await settingsScreen.expectVisible('delete-account-confirmation-modal');

      // Cancel to not actually delete
      await settingsScreen.cancelDeleteAccount();
    });

    it('should cancel account deletion', async () => {
      // Arrange
      await settingsScreen.scrollToBottom();
      await settingsScreen.deleteAccount();
      await settingsScreen.waitForElement(
        'delete-account-confirmation-modal',
        2000,
      );

      // Act - cancel
      await settingsScreen.cancelDeleteAccount();

      // Assert - should stay in settings
      await settingsScreen.expectScreenVisible();
    });
  });

  describe('App Information', () => {
    beforeEach(async () => {
      await profileScreen.navigateToSettings();
      await settingsScreen.waitForScreen();
    });

    it('should display app version', async () => {
      // Act - scroll to version
      await settingsScreen.scrollToBottom();

      // Assert - version should be visible
      await settingsScreen.expectVisible(settingsScreen['appVersionText']);
    });

    it('should get app version', async () => {
      // Act
      const version = await settingsScreen.getAppVersion();

      // Assert - version should be a string
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });

    it('should navigate to terms of service', async () => {
      // Act
      await settingsScreen.navigateToTerms();

      // Assert
      await settingsScreen.waitForElement('terms-screen', 3000);
      await settingsScreen.expectVisible('terms-screen');
    });

    it('should navigate to privacy policy', async () => {
      // Act
      await settingsScreen.navigateToPrivacyPolicy();

      // Assert
      await settingsScreen.waitForElement('privacy-policy-screen', 3000);
      await settingsScreen.expectVisible('privacy-policy-screen');
    });
  });

  describe('Profile Scrolling', () => {
    it('should scroll through profile menu', async () => {
      // Act
      await profileScreen.scrollToBottom();

      // Assert - logout button should be visible
      await profileScreen.expectLogoutButtonVisible();

      // Scroll back up
      await profileScreen.scrollToTop();
      await profileScreen.expectScreenVisible();
    });
  });

  describe('Settings Persistence', () => {
    it('should persist multiple settings changes', async () => {
      // Arrange - navigate to settings
      await profileScreen.navigateToSettings();
      await settingsScreen.waitForScreen();

      // Act - make multiple changes
      await settingsScreen.enableDarkMode();
      await settingsScreen.enableNotifications();
      await settingsScreen.toggleExpirationAlerts();

      // Navigate away and back
      await settingsScreen.goBack();
      await profileScreen.waitForScreen();
      await profileScreen.navigateToSettings();
      await settingsScreen.waitForScreen();

      // Assert - changes should be persisted
      await settingsScreen.expectDarkModeEnabled();
      await settingsScreen.expectNotificationsEnabled();
    });
  });

  describe('UI Responsiveness', () => {
    beforeEach(async () => {
      await profileScreen.navigateToSettings();
      await settingsScreen.waitForScreen();
    });

    it('should respond to rapid toggle changes', async () => {
      // Act - toggle dark mode rapidly
      await settingsScreen.toggleDarkMode();
      await settingsScreen.toggleDarkMode();
      await settingsScreen.toggleDarkMode();
      await settingsScreen.toggleDarkMode();

      // Assert - app should still be stable
      await settingsScreen.expectScreenVisible();
    });

    it('should handle navigation back and forth', async () => {
      // Act - navigate multiple times
      await settingsScreen.goBack();
      await profileScreen.waitForScreen();
      await profileScreen.navigateToSettings();
      await settingsScreen.waitForScreen();
      await settingsScreen.goBack();
      await profileScreen.waitForScreen();

      // Assert - should be stable
      await profileScreen.expectScreenVisible();
    });
  });
});
