import type { StateCreator } from 'zustand';
import { changeLanguage } from '#/i18n';
import { requirePlatform } from '#platform/install';
import { PREFERENCE_DEFAULTS, type ThemePreference } from './preferenceTypes';
import type {
  FontScalePreference,
  DensityPreference,
  PantrySortOption,
  PantrySortDirection,
} from './preferenceTypes';
import type { RootState } from '../index';
import { DEFAULT_CURRENCY } from '#/utils/formatters/number';
import {
  MIRRORED_SETTINGS,
  type MirroredSettings,
} from '#/domain/serverSettings';

// Per-user preferences (keyed by userId)
export interface UserPreferences {
  showShoppingListImages: boolean;
  /**
   * The device's Budget & prices switch from before the account kept it: read
   * once to carry an "on" over. A `false` may be a default, never an answer.
   */
  budgetAndPrices?: boolean;
}

export const defaultUserPreferences: Required<UserPreferences> = {
  showShoppingListImages: true,
  budgetAndPrices: false,
};

export interface PreferencesState extends MirroredSettings {
  // Theme
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;

  // Language
  language?: string;
  setLanguage: (language: string) => void;

  // Remember Me (keep here as it's a preference)

  // Haptic Feedback
  hapticFeedbackEnabled: boolean;
  setHapticFeedbackEnabled: (enabled: boolean) => void;

  // Navigation Labels
  showNavigationLabels: boolean;
  setShowNavigationLabels: (enabled: boolean) => void;

  // Settings the server owns, mirrored so a first paint does not wait on
  // `GetUserSettings` (`MIRRORED_SETTINGS`).
  mirrorSettings: (settings: Partial<MirroredSettings>) => void;

  // Currency — mirrored for the same reason, and read by every money surface:
  // an Apollo watcher per list cell would be a query subscription per row.
  preferredCurrency: string;
  setPreferredCurrency: (code: string) => void;

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
  hapticFeedbackEnabled: true, // Enabled by default
  showNavigationLabels: true, // Enabled by default
  ...MIRRORED_SETTINGS,
  preferredCurrency: DEFAULT_CURRENCY,
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
    // Applied BEFORE Zustand notifies subscribers, so every component renders
    // with the new colors on the first pass.
    requirePlatform('appearance').applyTheme(theme);
    set({ theme });
  },
  setLanguage: language => {
    void changeLanguage(language);
    set({ language });
  },
  setHapticFeedbackEnabled: enabled => set({ hapticFeedbackEnabled: enabled }),
  setShowNavigationLabels: enabled => set({ showNavigationLabels: enabled }),

  mirrorSettings: settings => set(settings),
  setPreferredCurrency: code => set({ preferredCurrency: code }),
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
    // Applied BEFORE the Zustand notification, so a picked swatch shows on the
    // next frame, not after the useAppearance effect.
    requirePlatform('appearance').apply({
      primaryColorOverride: color,
      densityPreference: get().densityPreference,
      fontScalePreference: get().fontScalePreference,
      highContrast: get().highContrast,
    });
    set({ primaryColorOverride: color });
  },
  setDensityPreference: density => {
    requirePlatform('appearance').apply({
      primaryColorOverride: get().primaryColorOverride,
      densityPreference: density,
      fontScalePreference: get().fontScalePreference,
      highContrast: get().highContrast,
    });
    set({ densityPreference: density });
  },
  setFontScalePreference: scale => {
    requirePlatform('appearance').apply({
      primaryColorOverride: get().primaryColorOverride,
      densityPreference: get().densityPreference,
      fontScalePreference: scale,
      highContrast: get().highContrast,
    });
    set({ fontScalePreference: scale });
  },
  setHighContrast: enabled => {
    requirePlatform('appearance').apply({
      primaryColorOverride: get().primaryColorOverride,
      densityPreference: get().densityPreference,
      fontScalePreference: get().fontScalePreference,
      highContrast: enabled,
    });
    set({ highContrast: enabled });
  },

  resetPreferences: () => set(initialPreferencesState),
});
