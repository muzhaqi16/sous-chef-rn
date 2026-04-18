// Personal Information screen configuration (shown when navigating to Personal Information)
export const PERSONAL_INFO_CONFIG = [
  {
    title: 'Personal Information',
    items: [
      {
        key: 'email',
        label: 'Email',
        type: 'info',
      },
      {
        key: 'firstName',
        label: 'First Name',
        type: 'text',
      },
      {
        key: 'lastName',
        label: 'Last Name',
        type: 'text',
      },
      {
        key: 'displayName',
        label: 'Display Name',
        type: 'text',
      },
      {
        key: 'bio',
        label: 'Bio',
        type: 'text',
      },
      {
        key: 'phone',
        label: 'Phone',
        type: 'text',
      },
      {
        key: 'dateOfBirth',
        label: 'Date of Birth',
        type: 'text',
      },
      {
        key: 'gender',
        label: 'Gender',
        type: 'modal',
        options: [
          { label: 'Male', value: 'male' },
          { label: 'Female', value: 'female' },
          { label: 'Non-binary', value: 'non-binary' },
          { label: 'Other', value: 'other' },
          { label: 'Prefer not to say', value: 'prefer-not-to-say' },
        ],
      },
    ],
  },
  {
    title: 'Privacy Settings',
    items: [
      {
        key: 'profileVisibility',
        label: 'Profile Visibility',
        type: 'modal',
        options: [
          { label: 'Public', value: 'PUBLIC' },
          { label: 'Friends Only', value: 'FRIENDS_ONLY' },
          { label: 'Private', value: 'PRIVATE' },
        ],
      },
      {
        key: 'showEmail',
        label: 'Show Email',
        type: 'switch',
      },
      {
        key: 'showPhone',
        label: 'Show Phone',
        type: 'switch',
      },
    ],
  },
];

// Main profile settings configuration (shown in ProfileScreen)
export const PROFILE_SETTINGS_CONFIG = [
  {
    title: 'Personal Information',
    items: [
      {
        key: 'personalInformation',
        label: 'Personal Information',
        type: 'navigation',
      },
    ],
  },
  {
    title: 'Appearance & Language',
    items: [
      {
        key: 'appearance',
        label: 'Appearance',
        type: 'navigation',
        subtitle: 'Theme, brand color, density, font scale',
      },
      {
        key: 'theme',
        label: 'Theme',
        type: 'modal',
        options: [
          { label: '☀️ Light', value: 'LIGHT' },
          { label: '🌙 Dark', value: 'DARK' },
          { label: '📱 System', value: 'SYSTEM' },
        ],
      },
      {
        key: 'language',
        label: 'Language',
        type: 'modal',
        options: [{ label: 'English', value: 'en' }],
      },
    ],
  },
  {
    title: 'Notifications',
    items: [
      {
        key: 'notifications',
        label: 'Notifications',
        type: 'navigation',
      },
    ],
  },
  {
    title: 'Dietary Profile',
    items: [
      {
        key: 'dietaryProfile',
        label: 'Dietary Profile',
        type: 'navigation',
      },
    ],
  },
  {
    title: 'App Settings',
    items: [
      {
        key: 'appSettings',
        label: 'App Settings',
        type: 'navigation',
      },
    ],
  },
  {
    title: 'Security',
    items: [
      {
        key: 'biometricAuthentication',
        label: 'Biometric Authentication',
        type: 'switch',
        subtitle: 'Use fingerprint or face recognition to login',
      },
      {
        key: 'changePassword',
        label: 'Change Password',
        type: 'navigation',
        subtitle: 'Update your account password',
      },
    ],
  },
  {
    title: 'Developer',
    items: [
      {
        key: 'debugInfo',
        label: 'Debug Info',
        type: 'navigation',
      },
      {
        key: 'performanceDashboard',
        label: 'Performance Dashboard',
        type: 'navigation',
      },
    ],
  },
  {
    title: '',
    items: [
      {
        key: 'logout',
        label: 'Log Out',
        type: 'action',
      },
    ],
  },
];
