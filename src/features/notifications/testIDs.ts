/**
 * The notifications feature's testIDs, shared by the app and the e2e page
 * objects. No imports: Detox's Jest reads this by relative path.
 */
export const notificationsTestIDs = {
  /** The `FilterTabs` prefix; one tab is `kitTestIDs.filterTab(prefix, id)`. */
  filterTabs: 'notification-filter-tab',
  settingsState: 'notification-settings-state',

  /** A notification setting's switch, by its `NotificationSettings` key. */
  settingSwitch: (key: string) => `notification-switch-${key}`,
};
