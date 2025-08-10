import {JSX} from 'react';

export interface SettingsSection {
  title: string;
  items: SettingItem[];
}

export type SettingType = 'text' | 'switch' | 'modal' | 'radio' | 'action';

export interface SettingItem {
  key: string;
  label: string;
  type: SettingType;
  icon?: JSX.Element;
  value?: string | boolean;
  onPress?: () => void;
  onSave?: (val: any) => void;
  options?: {label: string; value: string}[];
  selected?: string;
}

// Define profile field keys explicitly - updated to match your fields
export type ProfileFieldKey =
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'dateOfBirth' // Changed from 'dateOfBirth' to match your config
  | 'avatar'; // Added avatar since it's used in ProfileHeader

// Define store field keys explicitly
export type StoreFieldKey =
  | 'theme'
  | 'language'
  | 'emailNotifications'
  | 'pushNotifications';

// Updated to match the actual implementation approach
export interface SettingConfig {
  key: string;
  label: string;
  type: SettingType;
  field?: ProfileFieldKey;
  storeKey?: StoreFieldKey;
  validation?: (value: any) => string | null;
  transform?: (value: any) => any;
  options?: Array<{label: string; value: string}>;
}

// Additional types that might be helpful for your implementation
export interface ProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  avatar?: string;
}

export interface UserPreferences {
  theme?: 'light' | 'dark';
  language?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
}

// Store interface to ensure type safety
export interface Store {
  theme: 'light' | 'dark';
  language: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: string) => void;
  setEmailNotifications: (enabled: boolean) => void;
  setPushNotifications: (enabled: boolean) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  logout: () => void;
}
