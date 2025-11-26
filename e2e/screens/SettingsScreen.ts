/**
 * SettingsScreen
 *
 * Screen object model for the Settings screen.
 * Provides methods for interacting with app settings and preferences.
 */

import { BaseScreen } from './BaseScreen';
import { element, by, waitFor, expect } from 'detox';

export class SettingsScreen extends BaseScreen {
  protected screenID = 'settings-screen';

  // Element IDs
  private readonly scrollView = 'settings-scroll-view';
  private readonly backButton = 'settings-back-button';

  // Appearance
  private readonly themeToggle = 'settings-theme-toggle';
  private readonly darkModeSwitch = 'settings-dark-mode-switch';

  // Notifications
  private readonly notificationsToggle = 'settings-notifications-toggle';
  private readonly expirationAlertsSwitch = 'settings-expiration-alerts-switch';
  private readonly lowStockAlertsSwitch = 'settings-low-stock-alerts-switch';
  private readonly recipeAlertsSwitch = 'settings-recipe-alerts-switch';

  // Data & Privacy
  private readonly clearCacheButton = 'settings-clear-cache-button';
  private readonly exportDataButton = 'settings-export-data-button';
  private readonly deleteAccountButton = 'settings-delete-account-button';

  // Account
  private readonly changePasswordButton = 'settings-change-password-button';
  private readonly changeEmailButton = 'settings-change-email-button';

  // App Info
  private readonly appVersionText = 'settings-app-version';
  private readonly termsButton = 'settings-terms-button';
  private readonly privacyPolicyButton = 'settings-privacy-policy-button';

  /**
   * Go back to profile screen
   */
  async goBackToProfile() {
    await this.goBack();
    await waitFor(element(by.id('profile-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Toggle dark mode
   */
  async toggleDarkMode() {
    await this.tapByID(this.darkModeSwitch);
  }

  /**
   * Enable dark mode
   */
  async enableDarkMode() {
    const isDarkMode = await this.isDarkModeEnabled();
    if (!isDarkMode) {
      await this.toggleDarkMode();
    }
  }

  /**
   * Disable dark mode
   */
  async disableDarkMode() {
    const isDarkMode = await this.isDarkModeEnabled();
    if (isDarkMode) {
      await this.toggleDarkMode();
    }
  }

  /**
   * Check if dark mode is enabled
   */
  async isDarkModeEnabled(): Promise<boolean> {
    try {
      const attributes = await this.getElementById(
        this.darkModeSwitch,
      ).getAttributes();
      return (attributes as any).value === true;
    } catch {
      return false;
    }
  }

  /**
   * Toggle notifications
   */
  async toggleNotifications() {
    await this.tapByID(this.notificationsToggle);
  }

  /**
   * Enable notifications
   */
  async enableNotifications() {
    const isEnabled = await this.isNotificationsEnabled();
    if (!isEnabled) {
      await this.toggleNotifications();
    }
  }

  /**
   * Disable notifications
   */
  async disableNotifications() {
    const isEnabled = await this.isNotificationsEnabled();
    if (isEnabled) {
      await this.toggleNotifications();
    }
  }

  /**
   * Check if notifications are enabled
   */
  async isNotificationsEnabled(): Promise<boolean> {
    try {
      const attributes = await this.getElementById(
        this.notificationsToggle,
      ).getAttributes();
      return (attributes as any).value === true;
    } catch {
      return false;
    }
  }

  /**
   * Toggle expiration alerts
   */
  async toggleExpirationAlerts() {
    await this.tapByID(this.expirationAlertsSwitch);
  }

  /**
   * Toggle low stock alerts
   */
  async toggleLowStockAlerts() {
    await this.tapByID(this.lowStockAlertsSwitch);
  }

  /**
   * Toggle recipe alerts
   */
  async toggleRecipeAlerts() {
    await this.tapByID(this.recipeAlertsSwitch);
  }

  /**
   * Clear app cache
   */
  async clearCache() {
    await this.scrollTo(this.scrollView, 'bottom');
    await this.tapByID(this.clearCacheButton);

    // Wait for confirmation dialog
    try {
      await waitFor(element(by.id('clear-cache-confirmation-modal')))
        .toBeVisible()
        .withTimeout(2000);
      await this.tapByID('confirm-clear-cache-button');

      // Wait for success message or modal to close
      await waitFor(element(by.id('clear-cache-confirmation-modal')))
        .not.toBeVisible()
        .withTimeout(3000);
    } catch {
      // No confirmation dialog
    }
  }

  /**
   * Export user data
   */
  async exportData() {
    await this.scrollTo(this.scrollView, 'bottom');
    await this.tapByID(this.exportDataButton);

    // Wait for export confirmation or success message
    try {
      await waitFor(element(by.id('export-data-modal')))
        .toBeVisible()
        .withTimeout(2000);
    } catch {
      // Modal might not appear
    }
  }

  /**
   * Delete account
   */
  async deleteAccount() {
    await this.scrollTo(this.scrollView, 'bottom');
    await this.tapByID(this.deleteAccountButton);

    // Wait for confirmation dialog
    await waitFor(element(by.id('delete-account-confirmation-modal')))
      .toBeVisible()
      .withTimeout(2000);
  }

  /**
   * Confirm account deletion
   */
  async confirmDeleteAccount() {
    await this.tapByID('confirm-delete-account-button');

    // Wait for login screen after deletion
    await waitFor(element(by.id('login-screen')))
      .toBeVisible()
      .withTimeout(5000);
  }

  /**
   * Cancel account deletion
   */
  async cancelDeleteAccount() {
    await this.tapByID('cancel-delete-account-button');

    // Wait for modal to close
    await waitFor(element(by.id('delete-account-confirmation-modal')))
      .not.toBeVisible()
      .withTimeout(2000);
  }

  /**
   * Navigate to change password
   */
  async navigateToChangePassword() {
    await this.tapByID(this.changePasswordButton);
    await waitFor(element(by.id('change-password-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Navigate to change email
   */
  async navigateToChangeEmail() {
    await this.tapByID(this.changeEmailButton);
    await waitFor(element(by.id('change-email-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Navigate to terms of service
   */
  async navigateToTerms() {
    await this.scrollTo(this.scrollView, 'bottom');
    await this.tapByID(this.termsButton);
    await waitFor(element(by.id('terms-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Navigate to privacy policy
   */
  async navigateToPrivacyPolicy() {
    await this.scrollTo(this.scrollView, 'bottom');
    await this.tapByID(this.privacyPolicyButton);
    await waitFor(element(by.id('privacy-policy-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Scroll to bottom of settings
   */
  async scrollToBottom() {
    await this.scrollTo(this.scrollView, 'bottom');
  }

  /**
   * Scroll to top of settings
   */
  async scrollToTop() {
    await this.scrollTo(this.scrollView, 'top');
  }

  /**
   * Get app version
   */
  async getAppVersion(): Promise<string> {
    await this.scrollTo(this.scrollView, 'bottom');
    const attributes = await this.getElementById(
      this.appVersionText,
    ).getAttributes();
    return (attributes as any).text || '';
  }

  /**
   * Expect app version to be displayed
   */
  async expectAppVersion(version: string) {
    await this.scrollTo(this.scrollView, 'bottom');
    await expect(this.getElementById(this.appVersionText)).toHaveText(version);
  }

  /**
   * Expect dark mode to be enabled
   */
  async expectDarkModeEnabled() {
    await expect(this.getElementById(this.darkModeSwitch)).toHaveToggleValue(
      true,
    );
  }

  /**
   * Expect dark mode to be disabled
   */
  async expectDarkModeDisabled() {
    await expect(this.getElementById(this.darkModeSwitch)).toHaveToggleValue(
      false,
    );
  }

  /**
   * Expect notifications to be enabled
   */
  async expectNotificationsEnabled() {
    await expect(this.getElementById(this.notificationsToggle)).toHaveToggleValue(
      true,
    );
  }

  /**
   * Expect notifications to be disabled
   */
  async expectNotificationsDisabled() {
    await expect(this.getElementById(this.notificationsToggle)).toHaveToggleValue(
      false,
    );
  }
}
