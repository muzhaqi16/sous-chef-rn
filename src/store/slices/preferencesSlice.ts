import { StateCreator } from 'zustand';
import { UnistylesRuntime } from 'react-native-unistyles';
import { RootState } from '../index';

/**
 * Apply a `ThemePreference` to `UnistylesRuntime`. Shared between the in-app
 * setter (`setTheme` action) and the post-rehydration sync run from the
 * Zustand persist `onRehydrateStorage` callback. Single source of truth for
 * preference → runtime translation, called from both paths so they can't
 * diverge.
 */
export function applyThemePreferenceToRuntime(theme: ThemePreference): void {
  try {
    if (theme === ThemePreference.SYSTEM) {
      UnistylesRuntime.setAdaptiveThemes(true);
    } else {
      UnistylesRuntime.setAdaptiveThemes(false);
      const target = theme === ThemePreference.DARK ? 'dark' : 'light';
      if (UnistylesRuntime.themeName !== target) {
        UnistylesRuntime.setTheme(target);
      }
    }
  } catch (e) {
    if (__DEV__) console.warn('[applyThemePreferenceToRuntime] error:', e);
  }
}

// Pantry sort preferences
export type PantrySortOption = 'name' | 'expiry' | 'quantity' | 'recent';
export type PantrySortDirection = 'asc' | 'desc';

// Per-user preferences (keyed by userId)
export interface UserPreferences {
  showShoppingListImages: boolean;
}

export const defaultUserPreferences: UserPreferences = {
  showShoppingListImages: true,
};

export enum ThemePreference {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
  SYSTEM = 'SYSTEM',
}

export type DensityPreference = 'compact' | 'comfortable' | 'spacious';
export type FontScalePreference = 'system' | 'sm' | 'md' | 'lg' | 'xl';

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

  // Per-user preferences
  userPreferences: Record<string, UserPreferences>;
  setUserPreference: (userId: string, prefs: Partial<UserPreferences>) => void;
  getUserPreferences: (userId: string) => UserPreferences;
  resetUserPreferences: (userId: string) => void;

  // Appearance customization
  primaryColorOverride: string | null;
  densityPreference: DensityPreference;
  fontScalePreference: FontScalePreference;
  highContrast: boolean;
  setPrimaryColorOverride: (color: string | null) => void;
  setDensityPreference: (density: DensityPreference) => void;
  setFontScalePreference: (scale: FontScalePreference) => void;
  setHighContrast: (enabled: boolean) => void;

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
  primaryColorOverride: null as string | null,
  densityPreference: 'comfortable' as DensityPreference,
  fontScalePreference: 'system' as FontScalePreference,
  highContrast: false,
};

export const createPreferencesSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  PreferencesState
> = (set, get) => ({
  ...initialPreferencesState,
  userPreferences: {},

  setTheme: theme => {
    // Apply native theme BEFORE Zustand notifies subscribers, so all components
    // render with correct StyleSheet colors on the first pass.
    applyThemePreferenceToRuntime(theme);
    set({ theme });
  },
  setLanguage: language => set({ language }),
  setEmailNotifications: enabled => set({ emailNotifications: enabled }),
  setNotificationsEnabled: enabled => set({ pushNotifications: enabled }),
  setRememberMe: remember => set({ rememberMe: remember }),
  setHapticFeedbackEnabled: enabled => set({ hapticFeedbackEnabled: enabled }),
  setShowNavigationLabels: enabled => set({ showNavigationLabels: enabled }),
  setPantrySortOption: option => set({ pantrySortOption: option }),
  setPantrySortDirection: direction => set({ pantrySortDirection: direction }),

  setUserPreference: (userId, prefs) => {
    set(state => {
      const existing = state.userPreferences[userId] ?? {
        ...defaultUserPreferences,
      };
      state.userPreferences[userId] = { ...existing, ...prefs };
    });
  },

  getUserPreferences: userId => {
    return get().userPreferences[userId] ?? defaultUserPreferences;
  },

  resetUserPreferences: userId => {
    set(state => {
      state.userPreferences[userId] = { ...defaultUserPreferences };
    });
  },

  setPrimaryColorOverride: color => set({ primaryColorOverride: color }),
  setDensityPreference: density => set({ densityPreference: density }),
  setFontScalePreference: scale => set({ fontScalePreference: scale }),
  setHighContrast: enabled => set({ highContrast: enabled }),

  resetPreferences: () => set(initialPreferencesState),
});
