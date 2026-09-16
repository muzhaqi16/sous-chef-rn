/**
 * The testIDs shared components render. The app and the e2e page objects both
 * import this file, so a renamed id fails the build instead of a Detox run. It
 * has no imports: Detox's Jest reads it by relative path, outside the aliases.
 */
export const kitTestIDs = {
  headerBackButton: 'header-back-button',
  headerCloseButton: 'header-close-button',
  offlineBanner: 'offline-banner',
  spotlightTarget: 'spotlight-target',
  spotlightSkipButton: 'spotlight-skip-button',
  splashScreen: 'splash-screen',
  tabBar: 'tab-bar',
  tabBarAddButton: 'tab-bar-add-button',
  toastMessage: 'toast-message',
  filterTabsPrefix: 'filter-tab',
  alertModal: 'alert-modal',
  alertModalBehind: 'alert-modal-behind',
  stateLoading: 'state-loading',
  stateOffline: 'state-offline',
  stateError: 'state-error',

  /** A floating tab bar button, by its route name. */
  tab: (routeName: string) =>
    `tab-${routeName.toLowerCase().replace(/\s+/g, '-')}`,
  toast: (type: string) => `toast-${type}`,
  pageIndicator: (index: number) => `page-indicator-${index}`,
  alertButton: (index: number) => `alert-button-${index}`,
  /** `SettingRow`'s default ids, by the setting's key. */
  settingButton: (key: string) => `profile-${key}-button`,
  settingSwitch: (key: string) => `profile-${key}-switch`,
  /** `BaseInput`'s error text, under the input's id. */
  inputError: (inputID: string) => `${inputID}-error`,

  /** `FilterTabs`: one tab, and the trailing action button. */
  filterTab: (prefix: string, tabId: string) => `${prefix}-${tabId}`,
  filterTabAction: (prefix: string) => `${prefix}-action`,
  /** `SwipeableItem`: an action on a row whose prefix already names the row. */
  swipeAction: (rowPrefix: string, actionKey: string) =>
    `${rowPrefix}-${actionKey}`,
  /** `ItemList`: a row by its position. */
  listItem: (prefix: string, index: number) => `${prefix}-${index}`,
  /** `BiometricSetupView`'s two buttons, under the caller's id. */
  biometricEnable: (prefix: string) => `${prefix}-enable`,
  biometricSkip: (prefix: string) => `${prefix}-skip`,
};
