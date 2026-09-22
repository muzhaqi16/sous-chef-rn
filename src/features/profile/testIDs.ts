/**
 * The profile feature's testIDs: the profile menu, app settings and cooking
 * preferences. No imports: e2e reads this by relative path, outside the aliases.
 */
export const profileTestIDs = {
  profileScreen: 'profile-screen',
  profileScrollView: 'profile-scroll-view',
  verifyEmailBanner: 'verify-email-banner',
  logoutButton: 'profile-logout-button',

  settingsScreen: 'settings-screen',
  settingsState: 'settings-state',
  settingsUnitSystemPicker: 'settings-unit-system-picker',
  settingsAutoSyncSwitch: 'settings-auto-sync-switch',
  settingsOfflineModeSwitch: 'settings-offline-mode-switch',
  settingsShowTutorialsSwitch: 'settings-show-tutorials-switch',
  settingsHapticFeedbackSwitch: 'settings-haptic-feedback-switch',
  settingsNavigationLabelsSwitch: 'settings-navigation-labels-switch',
  settingsShowShoppingListImagesSwitch:
    'settings-show-shopping-list-images-switch',
  settingsShareUsageDataSwitch: 'settings-share-usage-data-switch',

  cookingPreferencesSkillLevelPicker: 'cooking-preferences-skill-level-picker',

  /** A navigation row on the profile menu, by its settings-config key. */
  menuItem: (key: string) => `profile-menu-${key}`,
};
