import { StateCreator } from 'zustand';
import { RootState } from '../index';

// Pantry sort preferences
export type PantrySortOption = 'name' | 'expiry' | 'quantity' | 'recent';
export type PantrySortDirection = 'asc' | 'desc';

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

  // Haptic Feedback
  hapticFeedbackEnabled: boolean;
  setHapticFeedbackEnabled: (enabled: boolean) => void;

  // Navigation Labels
  showNavigationLabels: boolean;
  setShowNavigationLabels: (enabled: boolean) => void;

  // Pantry Sort Preferences
  pantrySortOption: PantrySortOption;
  pantrySortDirection: PantrySortDirection;
  setPantrySortOption: (option: PantrySortOption) => void;
  setPantrySortDirection: (direction: PantrySortDirection) => void;

  // Reset
  resetPreferences: () => void;
}

const initialPreferencesState = {
  theme: ThemePreference.SYSTEM,
  language: undefined,
  emailNotifications: false,
  pushNotifications: false,
  rememberMe: undefined,
  hapticFeedbackEnabled: true, // Enabled by default
  showNavigationLabels: true, // Enabled by default
  pantrySortOption: 'recent' as PantrySortOption,
  pantrySortDirection: 'desc' as PantrySortDirection, // Newest first
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
  setHapticFeedbackEnabled: enabled => set({ hapticFeedbackEnabled: enabled }),
  setShowNavigationLabels: enabled => set({ showNavigationLabels: enabled }),
  setPantrySortOption: option => set({ pantrySortOption: option }),
  setPantrySortDirection: direction => set({ pantrySortDirection: direction }),

  resetPreferences: () => set(initialPreferencesState),
});
