/**
 * Declarative structure of the profile and personal-information screens.
 *
 * Every user-facing string here is an i18n KEY, resolved by the screen that
 * renders it. It used to be English text, translated afterwards by five lookup
 * maps spread across two screens — three of them keyed on the English string
 * itself, so renaming a section title in this file silently fell back to
 * rendering that title untranslated, in every language, with nothing failing.
 *
 * Keys rather than resolved strings for the usual reason: this module is
 * evaluated at import, before the stored language is applied.
 *
 * There is deliberately no subtitle field. The old config carried two, and
 * nothing ever read them — the biometric row builds its subtitle at runtime
 * from the device's capability, and the change-password row shows none.
 */

export interface SettingOptionConfig {
  labelKey: string;
  value: string;
}

export interface SettingItemConfig {
  key: string;
  labelKey: string;
  type: string;
  options?: SettingOptionConfig[];
}

export interface SettingSectionConfig {
  /**
   * Stable identity, independent of what the section is called on screen.
   *
   * Screens branch on this (`section.id === 'developer'`). They used to branch
   * on the English title, which tied control flow to display copy.
   */
  id: string;
  /** Empty for an unlabelled trailing group (the log-out row). */
  titleKey: string;
  items: SettingItemConfig[];
}

// Personal Information screen configuration
export const PERSONAL_INFO_CONFIG: SettingSectionConfig[] = [
  {
    id: 'personalInformation',
    titleKey: 'labels.personalInformation',
    items: [
      { key: 'email', labelKey: 'personalInformation.email', type: 'info' },
      {
        key: 'firstName',
        labelKey: 'personalInformation.firstName',
        type: 'text',
      },
      {
        key: 'lastName',
        labelKey: 'personalInformation.lastName',
        type: 'text',
      },
      {
        key: 'displayName',
        labelKey: 'personalInformation.displayName',
        type: 'text',
      },
      { key: 'bio', labelKey: 'personalInformation.bio', type: 'text' },
      { key: 'phone', labelKey: 'personalInformation.phone', type: 'text' },
      {
        key: 'dateOfBirth',
        labelKey: 'personalInformation.dateOfBirth',
        type: 'text',
      },
      {
        key: 'gender',
        labelKey: 'personalInformation.gender',
        type: 'modal',
        options: [
          { labelKey: 'personalInformation.genderMale', value: 'male' },
          { labelKey: 'personalInformation.genderFemale', value: 'female' },
          {
            labelKey: 'personalInformation.genderNonBinary',
            value: 'non-binary',
          },
          { labelKey: 'itemType.OTHER', value: 'other' },
          {
            labelKey: 'personalInformation.genderPreferNotToSay',
            value: 'prefer-not-to-say',
          },
        ],
      },
    ],
  },
  {
    id: 'privacy',
    titleKey: 'personalInformation.sectionPrivacySettings',
    items: [
      {
        key: 'profileVisibility',
        labelKey: 'personalInformation.profileVisibility',
        type: 'modal',
        options: [
          { labelKey: 'personalInformation.visibilityPublic', value: 'PUBLIC' },
          {
            labelKey: 'personalInformation.visibilityFriendsOnly',
            value: 'FRIENDS_ONLY',
          },
          {
            labelKey: 'personalInformation.visibilityPrivate',
            value: 'PRIVATE',
          },
        ],
      },
      {
        key: 'showEmail',
        labelKey: 'personalInformation.showEmail',
        type: 'switch',
      },
      {
        key: 'showPhone',
        labelKey: 'personalInformation.showPhone',
        type: 'switch',
      },
    ],
  },
];

// Main profile settings configuration (shown in ProfileScreen)
export const PROFILE_SETTINGS_CONFIG: SettingSectionConfig[] = [
  {
    id: 'personalInformation',
    titleKey: 'labels.personalInformation',
    items: [
      {
        key: 'personalInformation',
        labelKey: 'labels.personalInformation',
        type: 'navigation',
      },
    ],
  },
  {
    id: 'appearanceAndLanguage',
    titleKey: 'profile.sections.appearanceAndLanguage',
    items: [
      { key: 'appearance', labelKey: 'labels.appearance', type: 'navigation' },
      {
        // Options injected by useConfigurableSettings from
        // SUPPORTED_LANGUAGES (src/i18n/config.ts), the single source of
        // truth for bundled locales.
        key: 'language',
        labelKey: 'labels.language',
        type: 'modal',
      },
    ],
  },
  {
    id: 'notifications',
    titleKey: 'labels.notifications',
    items: [
      {
        key: 'notifications',
        labelKey: 'labels.notifications',
        type: 'navigation',
      },
    ],
  },
  {
    id: 'dietaryProfile',
    titleKey: 'profile.sections.dietaryProfile',
    items: [
      {
        key: 'dietaryProfile',
        labelKey: 'profile.labels.dietaryProfile',
        type: 'navigation',
      },
    ],
  },
  {
    id: 'appSettings',
    titleKey: 'labels.appSettings',
    items: [
      {
        key: 'appSettings',
        labelKey: 'labels.appSettings',
        type: 'navigation',
      },
    ],
  },
  {
    id: 'security',
    titleKey: 'labels.security',
    items: [
      {
        key: 'biometricAuthentication',
        labelKey: 'profile.labels.biometricAuthentication',
        type: 'switch',
      },
      {
        key: 'changePassword',
        labelKey: 'labels.changePassword',
        type: 'navigation',
      },
    ],
  },
  {
    id: 'developer',
    titleKey: 'profile.sections.developer',
    items: [
      { key: 'debugInfo', labelKey: 'labels.debugInfo', type: 'navigation' },
      {
        key: 'performanceDashboard',
        labelKey: 'labels.performanceDashboard',
        type: 'navigation',
      },
    ],
  },
  {
    id: 'logout',
    titleKey: '',
    items: [
      { key: 'logout', labelKey: 'profile.labels.logout', type: 'action' },
    ],
  },
];
