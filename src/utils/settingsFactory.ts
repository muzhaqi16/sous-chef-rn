export const createPersonalItems = (
  profile: any,
  updateProfile: (input: any) => void,
): any[] => [
  {
    key: 'firstName',
    label: 'First Name',
    type: 'text',
    value: profile?.firstName || '',
    onSave: (val: string) => updateProfile({firstName: val}),
  },
  {
    key: 'lastName',
    label: 'Last Name',
    type: 'text',
    value: profile?.lastName || '',
    onSave: (val: string) => updateProfile({lastName: val}),
  },
  {
    key: 'phone',
    label: 'Phone',
    type: 'text',
    value: profile?.phone || '',
    onSave: (val: string) => updateProfile({phone: val}),
  },
  {
    key: 'dateOfBirth',
    label: 'Birthday',
    type: 'text',
    value: profile?.dateOfBirth || '',
    onSave: (val: string) => updateProfile({dateOfBirth: val}),
  },
];

export const createThemeItems = (
  store: any,
  updatePreferences: (input: any) => void,
): any[] => [
  {
    key: 'darkMode',
    label: 'Dark Mode',
    type: 'switch',
    value: store.theme === 'dark',
    onPress: () => {
      const newTheme = store.theme === 'dark' ? 'light' : 'dark';
      store.setTheme(newTheme);
      updatePreferences({theme: newTheme});
    },
  },
  {
    key: 'language',
    label: 'Language',
    type: 'modal',
    value: store.language,
    onSave: (val: string) => {
      store.setLanguage(val);
      updatePreferences({language: val});
    },
  },
];

export const createNotificationItems = (
  store: any,
  updatePreferences: (input: any) => void,
): any[] => [
  {
    key: 'emailNotif',
    label: 'Email Notifications',
    type: 'switch',
    value: store.emailNotifications,
    onPress: () => {
      const newValue = !store.emailNotifications;
      store.setEmailNotifications(newValue);
      updatePreferences({emailNotifications: newValue});
    },
  },
  {
    key: 'pushNotif',
    label: 'Push Notifications',
    type: 'switch',
    value: store.pushNotifications,
    onPress: () => {
      const newValue = !store.pushNotifications;
      store.setPushNotifications(newValue);
      updatePreferences({pushNotifications: newValue});
    },
  },
];

export const createLogoutItem = (logout: () => void): any => ({
  key: 'logout',
  label: 'Log Out',
  type: 'text',
  onPress: logout,
});
