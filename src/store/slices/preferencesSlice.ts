import { StateCreator } from 'zustand';
import { UnistylesRuntime } from 'react-native-unistyles';
import { changeLanguage } from '#/i18n';
import { applyAppearanceToRuntime } from '#/theme/applyAppearance';
import { ThemePreference, PREFERENCE_DEFAULTS } from './preferenceTypes';
import type {
  FontScalePreference,
  DensityPreference,
  PantrySortOption,
  PantrySortDirection,
} from './preferenceTypes';
import type { RootState } from '../index';
import { logger } from '#/utils/environment';

/**
 * The one preference → `UnistylesRuntime` translation, shared by the `setTheme`
 * action and the post-rehydration sync, so the two cannot diverge.
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
    if (__DEV__) logger.warn('[applyThemePreferenceToRuntime] error:', e);
  }
}

// Per-user preferences (keyed by userId)
export interface UserPreferences {
  showShoppingListImages: boolean;
}

export const defaultUserPreferences: UserPreferences = {
  showShoppingListImages: true,
};

export interface PreferencesState {
  // Theme
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;

  // Language
  language?: string;
  setLanguage: (language: string) => void;

  // Remember Me (keep here as it's a preference)
  rememberMe?: boolean;
  setRememberMe: (remember: boolean) => void;

  // Haptic Feedback
  hapticFeedbackEnabled: boolean;
  setHapticFeedbackEnabled: (enabled: boolean) => void;

  // Navigation Labels
  showNavigationLabels: boolean;
  setShowNavigationLabels: (enabled: boolean) => void;

  // Tutorials — the server owns the setting; this mirrors it so the first paint
  // does not wait on `GetUserSettings`.
  showTutorials: boolean;
  setShowTutorials: (enabled: boolean) => void;

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
  theme: PREFERENCE_DEFAULTS.theme,
  language: undefined,
  rememberMe: undefined,
  hapticFeedbackEnabled: true, // Enabled by default
  showNavigationLabels: true, // Enabled by default
  showTutorials: true,
  pantrySortOption: PREFERENCE_DEFAULTS.pantrySortOption,
  pantrySortDirection: PREFERENCE_DEFAULTS.pantrySortDirection, // Newest first
  primaryColorOverride: null,
  densityPreference: PREFERENCE_DEFAULTS.density,
  fontScalePreference: PREFERENCE_DEFAULTS.fontScale,
  highContrast: false,
} satisfies Partial<PreferencesState>;

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
  setLanguage: language => {
    void changeLanguage(language);
    set({ language });
  },
  setRememberMe: remember => set({ rememberMe: remember }),
  setHapticFeedbackEnabled: enabled => set({ hapticFeedbackEnabled: enabled }),
  setShowNavigationLabels: enabled => set({ showNavigationLabels: enabled }),

  setShowTutorials: enabled => set({ showTutorials: enabled }),
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

  setPrimaryColorOverride: color => {
    // Apply to the Unistyles runtime BEFORE the Zustand notification so the
    // ShadowTree updates synchronously with the state — picking a swatch in
    // AppearanceScreen reflects on the next frame instead of waiting for the
    // useAppearance effect to re-fire on the next render.
    applyAppearanceToRuntime({
      primaryColorOverride: color,
      densityPreference: get().densityPreference,
      fontScalePreference: get().fontScalePreference,
      highContrast: get().highContrast,
    });
    set({ primaryColorOverride: color });
  },
  setDensityPreference: density => {
    applyAppearanceToRuntime({
      primaryColorOverride: get().primaryColorOverride,
      densityPreference: density,
      fontScalePreference: get().fontScalePreference,
      highContrast: get().highContrast,
    });
    set({ densityPreference: density });
  },
  setFontScalePreference: scale => {
    applyAppearanceToRuntime({
      primaryColorOverride: get().primaryColorOverride,
      densityPreference: get().densityPreference,
      fontScalePreference: scale,
      highContrast: get().highContrast,
    });
    set({ fontScalePreference: scale });
  },
  setHighContrast: enabled => {
    applyAppearanceToRuntime({
      primaryColorOverride: get().primaryColorOverride,
      densityPreference: get().densityPreference,
      fontScalePreference: get().fontScalePreference,
      highContrast: enabled,
    });
    set({ highContrast: enabled });
  },

  resetPreferences: () => set(initialPreferencesState),
});
