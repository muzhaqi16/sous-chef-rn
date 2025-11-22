/**
 * ProfileScreen
 *
 * Screen object model for the Profile screen.
 * Provides methods for interacting with user profile and settings.
 */

import { BaseScreen } from './BaseScreen';
import { element, by, waitFor } from 'detox';

export class ProfileScreen extends BaseScreen {
  protected screenID = 'profile-screen';

  // Element IDs
  private readonly settingsButton = 'profile-settings-button';
  private readonly editProfileButton = 'profile-edit-button';
  private readonly userNameText = 'profile-user-name';
  private readonly userEmailText = 'profile-user-email';
  private readonly scrollView = 'profile-scroll-view';

  // Menu items
  private readonly preferencesButton = 'profile-menu-preferences';
  private readonly notificationsButton = 'profile-menu-notifications';
  private readonly privacyButton = 'profile-menu-privacy';
  private readonly helpButton = 'profile-menu-help';
  private readonly aboutButton = 'profile-menu-about';
  private readonly feedbackButton = 'profile-menu-feedback';
  private readonly logoutButton = 'profile-logout-button';

  /**
   * Navigate to profile tab
   */
  async navigateToTab() {
    await this.tapByID('tab-profile');
    await this.waitForScreen();
  }

  /**
   * Navigate to settings
   */
  async navigateToSettings() {
    await this.tapByID(this.settingsButton);
    await waitFor(element(by.id('settings-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Navigate to edit profile
   */
  async navigateToEditProfile() {
    await this.tapByID(this.editProfileButton);
    await waitFor(element(by.id('edit-profile-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Navigate to preferences
   */
  async navigateToPreferences() {
    await this.tapByID(this.preferencesButton);
    await waitFor(element(by.id('preferences-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Navigate to notifications settings
   */
  async navigateToNotifications() {
    await this.tapByID(this.notificationsButton);
    await waitFor(element(by.id('notifications-settings-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Navigate to privacy settings
   */
  async navigateToPrivacy() {
    await this.tapByID(this.privacyButton);
    await waitFor(element(by.id('privacy-settings-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Navigate to help/support
   */
  async navigateToHelp() {
    await this.tapByID(this.helpButton);
    await waitFor(element(by.id('help-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Navigate to about screen
   */
  async navigateToAbout() {
    await this.tapByID(this.aboutButton);
    await waitFor(element(by.id('about-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Navigate to feedback screen
   */
  async navigateToFeedback() {
    await this.tapByID(this.feedbackButton);
    await waitFor(element(by.id('feedback-screen')))
      .toBeVisible()
      .withTimeout(3000);
  }

  /**
   * Logout from the app
   */
  async logout() {
    // Scroll down until logout button is visible using whileElement pattern
    await waitFor(element(by.id(this.logoutButton)))
      .toBeVisible()
      .whileElement(by.id(this.scrollView))
      .scroll(200, 'down');

    await this.tapByID(this.logoutButton);

    // Wait for confirmation dialog
    try {
      await waitFor(element(by.id('logout-confirmation-modal')))
        .toBeVisible()
        .withTimeout(2000);
      await this.tapByID('confirm-logout-button');
    } catch {
      // No confirmation dialog
    }

    // Wait for either landing or login screen after logout
    try {
      await waitFor(element(by.id('landing-auth-screen')))
        .toBeVisible()
        .withTimeout(5000);
    } catch {
      // Might go directly to login screen
      await waitFor(element(by.id('login-screen')))
        .toBeVisible()
        .withTimeout(5000);
    }
  }

  /**
   * Scroll to bottom of profile
   */
  async scrollToBottom() {
    await this.scrollTo(this.scrollView, 'bottom');
  }

  /**
   * Scroll to top of profile
   */
  async scrollToTop() {
    await this.scrollTo(this.scrollView, 'top');
  }

  /**
   * Expect user name to be displayed
   */
  async expectUserName(name: string) {
    await expect(this.getElementById(this.userNameText)).toHaveText(name);
  }

  /**
   * Expect user email to be displayed
   */
  async expectUserEmail(email: string) {
    await expect(this.getElementById(this.userEmailText)).toHaveText(email);
  }

  /**
   * Expect settings button to be visible
   */
  async expectSettingsButtonVisible() {
    await this.expectVisible(this.settingsButton);
  }

  /**
   * Expect edit profile button to be visible
   */
  async expectEditProfileButtonVisible() {
    await this.expectVisible(this.editProfileButton);
  }

  /**
   * Expect logout button to be visible
   */
  async expectLogoutButtonVisible() {
    await this.expectVisible(this.logoutButton);
  }

  /**
   * Expect menu item to be visible
   */
  async expectMenuItemVisible(itemID: string) {
    await this.expectVisible(itemID);
  }
}
