import {StateCreator} from 'zustand';

export interface PreferencesState {
  preferences: {
    theme: 'light' | 'dark';
    onBoardingCompleted: boolean;
    language?: string;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    darkMode?: boolean;
  };
  setTheme: (theme: 'light' | 'dark') => void;
  setOnBoardingCompleted: (completed: boolean) => void;
  setLanguage: (language: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  updatePreferences: (prefs: Partial<PreferencesState['preferences']>) => void;
}

// Initial empty state
export const initialPreferencesState: Pick<PreferencesState, 'preferences'> = {
  preferences: {
    theme: 'light',
    onBoardingCompleted: false,
    pushNotifications: false,
    emailNotifications: false,
  },
};

export const createPreferencesSlice: StateCreator<PreferencesState> = set => ({
  ...initialPreferencesState,
  setTheme: theme =>
    set({
      preferences: {
        ...initialPreferencesState.preferences,
        theme,
      },
    }),
  setOnBoardingCompleted: completed =>
    set({
      preferences: {
        ...initialPreferencesState.preferences,
        onBoardingCompleted: completed,
      },
    }),
  setLanguage: language =>
    set({
      preferences: {
        ...initialPreferencesState.preferences,
        language,
      },
    }),
  setNotificationsEnabled: enabled =>
    set({
      preferences: {
        ...initialPreferencesState.preferences,
        emailNotifications: enabled,
        pushNotifications: enabled,
      },
    }),
  updatePreferences: prefs =>
    set(state => ({
      preferences: {
        ...state.preferences,
        ...prefs,
      },
    })),
});
