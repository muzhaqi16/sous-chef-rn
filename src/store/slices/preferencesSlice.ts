import { StateCreator } from 'zustand';
import { RootState } from '../index';

export enum ThemePreference {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
  SYSTEM = 'SYSTEM',
}

export interface PreferencesState {
  // Theme
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;

  // Language
  language?: string;
  setLanguage: (language: string) => void;

  // Notifications
  emailNotifications: boolean;
  pushNotifications: boolean;
  setEmailNotifications: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;

  // Remember Me (keep here as it's a preference)
  rememberMe?: boolean;
  setRememberMe: (remember: boolean) => void;

  // Reset
  resetPreferences: () => void;
}

const initialPreferencesState = {
  theme: ThemePreference.SYSTEM,
  language: undefined,
  emailNotifications: false,
  pushNotifications: false,
  rememberMe: undefined,
};

export const createPreferencesSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  PreferencesState
> = set => ({
  ...initialPreferencesState,

  setTheme: theme => set({ theme }),
  setLanguage: language => set({ language }),
  setEmailNotifications: enabled => set({ emailNotifications: enabled }),
  setNotificationsEnabled: enabled => set({ pushNotifications: enabled }),
  setRememberMe: remember => set({ rememberMe: remember }),

  resetPreferences: () => set(initialPreferencesState),
});
