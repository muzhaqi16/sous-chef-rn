export const PROFILE_SETTINGS_CONFIG = [
  {
    title: 'Personal Information',
    items: [
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
          {label: 'Male', value: 'male'},
          {label: 'Female', value: 'female'},
          {label: 'Non-binary', value: 'non-binary'},
          {label: 'Other', value: 'other'},
          {label: 'Prefer not to say', value: 'prefer-not-to-say'},
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
          {label: 'Public', value: 'PUBLIC'},
          {label: 'Friends Only', value: 'FRIENDS_ONLY'},
          {label: 'Private', value: 'PRIVATE'},
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
  {
    title: 'Theme & Language',
    items: [
      {
        key: 'theme',
        label: 'Theme',
        type: 'modal',
        options: [
          {label: '☀️ Light', value: 'light'},
          {label: '🌙 Dark', value: 'dark'},
          {label: '📱 System', value: 'system'},
        ],
      },
      {
        key: 'language',
        label: 'Language',
        type: 'modal',
        options: [
          {label: 'English', value: 'en'},
          {label: 'Spanish', value: 'es'},
          {label: 'French', value: 'fr'},
          {label: 'German', value: 'de'},
          {label: 'Italian', value: 'it'},
        ],
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
