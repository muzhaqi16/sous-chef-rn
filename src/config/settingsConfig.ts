/**
 * The profile screens' structure. Every user-facing string is an i18n KEY, as
 * this module is evaluated at import, before the stored language is applied.
 */

import { ProfileVisibility } from '#/graphql/generated/schemaTypes';
import type { TranslationKey } from '#/i18n';

export interface SettingOptionConfig {
  labelKey: TranslationKey;
  value: string;
}

export interface SettingItemConfig {
  key: string;
  labelKey: TranslationKey;
  type: string;
  /** A line under the label: what the setting is for and who sees it. */
  subtitleKey?: TranslationKey;
  /** `text` only: the example the edit sheet's empty input shows. */
  placeholderKey?: TranslationKey;
  options?: SettingOptionConfig[];
}

/**
 * The developer section's id, exported so screens gating on it import the
 * identity rather than repeating a literal — a literal comparison fails OPEN,
 * rendering the section for every user in every build.
 */
export const DEVELOPER_SECTION_ID = 'developer';

export interface SettingSectionConfig {
  /** Stable identity screens branch on, independent of the section's title. */
  id: string;
  /** Absent for an unlabelled trailing group (the log-out row). */
  titleKey?: TranslationKey;
  items: SettingItemConfig[];
}

// Personal Information screen configuration
export const PERSONAL_INFO_CONFIG: SettingSectionConfig[] = [
  {
    id: 'personalInformation',
    titleKey: 'labels.personalInformation',
    items: [
      {
        key: 'email',
        labelKey: 'personalInformation.email',
        type: 'info',
      },
      {
        key: 'firstName',
        labelKey: 'personalInformation.firstName',
        type: 'text',
        placeholderKey: 'personalInformation.firstNamePlaceholder',
      },
      {
        key: 'lastName',
        labelKey: 'personalInformation.lastName',
        type: 'text',
        placeholderKey: 'personalInformation.lastNamePlaceholder',
      },
      {
        key: 'displayName',
        labelKey: 'personalInformation.displayName',
        type: 'text',
        subtitleKey: 'personalInformation.displayNameSubtitle',
        placeholderKey: 'personalInformation.displayNamePlaceholder',
      },
      {
        key: 'bio',
        labelKey: 'personalInformation.bio',
        type: 'text',
        placeholderKey: 'personalInformation.bioPlaceholder',
      },
      {
        key: 'phone',
        labelKey: 'personalInformation.phone',
        type: 'text',
        placeholderKey: 'personalInformation.phonePlaceholder',
      },
      {
        key: 'dateOfBirth',
        labelKey: 'personalInformation.dateOfBirth',
        type: 'text',
        placeholderKey: 'personalInformation.dateOfBirthPlaceholder',
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
        subtitleKey: 'personalInformation.profileVisibilitySubtitle',
        // Values come from the generated enum, never typed by hand: the server
        // refuses a value the schema has no member for.
        options: [
          {
            labelKey: 'personalInformation.visibilityPublic',
            value: ProfileVisibility.Public,
          },
          {
            labelKey: 'labels.members',
            value: ProfileVisibility.Friends,
          },
          {
            labelKey: 'personalInformation.visibilityPrivate',
            value: ProfileVisibility.Private,
          },
        ],
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
      {
        // Options injected by useConfigurableSettings from the server's active
        // currency list. Not a display preference: the server records a cost it
        // is not told the currency of in this one.
        key: 'currency',
        labelKey: 'labels.currency',
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
      {
        key: 'dataSources',
        labelKey: 'profile.dataSources.title',
        type: 'navigation',
      },
      {
        key: 'myReports',
        labelKey: 'reports.myReportsTitle',
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
    id: DEVELOPER_SECTION_ID,
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
];
