/**
 * The profile feature's testIDs: the profile menu, app settings and cooking
 * preferences. No imports: e2e reads this by relative path, outside the aliases.
 */
export const profileTestIDs = {
  profileScreen: 'profile-screen',
  profileScrollView: 'profile-scroll-view',
  moreButton: 'profile-more-button',
  verifyEmailBanner: 'verify-email-banner',
  logoutButton: 'profile-logout-button',

  settingsScreen: 'settings-screen',
  dataSourcesScreen: 'data-sources-screen',
  dataSourceLink: (id: string) => `data-source-link-${id}`,
  settingsState: 'settings-state',
  settingsUnitSystemPicker: 'settings-unit-system-picker',
  settingsAutoSyncSwitch: 'settings-auto-sync-switch',
  settingsOfflineModeSwitch: 'settings-offline-mode-switch',
  settingsShowTutorialsSwitch: 'settings-show-tutorials-switch',
  settingsReceiptPhotosSwitch: 'settings-receipt-photos-switch',
  settingsHapticFeedbackSwitch: 'settings-haptic-feedback-switch',
  settingsNavigationLabelsSwitch: 'settings-navigation-labels-switch',
  settingsShowShoppingListImagesSwitch:
    'settings-show-shopping-list-images-switch',
  settingsStoreModeSwitch: 'settings-store-mode-switch',
  /** One home's switch in the dietary profile's "Shared with" section. */
  dietarySharingSwitch: (homeId: string) => `dietary-sharing-switch-${homeId}`,
  avoidSheet: 'dietary-avoid-sheet',
  avoidSeverity: 'dietary-avoid-severity',
  avoidSearchInput: 'dietary-avoid-search-input',
  /** One food the avoid sheet's search found. */
  avoidCandidate: (itemId: string) => `dietary-avoid-candidate-${itemId}`,
  settingsShareUsageDataSwitch: 'settings-share-usage-data-switch',

  cookingPreferencesSkillLevelPicker: 'cooking-preferences-skill-level-picker',

  /** A reason in the report sheet, by its `ReportType` value. */
  reportReason: (type: string) => `report-reason-${type}`,
  reportDescriptionInput: 'report-description-input',
  reportSendButton: 'report-send-button',
  reportFailure: 'report-failure',
  /** A row on the My reports screen, by report id. */
  reportRow: (id: string) => `report-row-${id}`,

  /** A navigation row on the profile menu, by its settings-config key. */
  menuItem: (key: string) => `profile-menu-${key}`,
};
