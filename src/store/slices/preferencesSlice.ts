import {StateCreator} from 'zustand';
import {RootState} from '../index';

export interface PreferencesState {
  preferences: {
    theme: 'light' | 'dark';
    onBoardingCompleted: boolean;
    language?: string;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    rememberMe?: boolean;
  };
  setTheme: (theme: 'light' | 'dark') => void;
  setOnBoardingCompleted: (completed: boolean) => void;
  setLanguage: (language: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  updatePreferences: (prefs: Partial<PreferencesState['preferences']>) => void;
}

export const initialPreferencesState: PreferencesState['preferences'] = {
  theme: 'light',
  onBoardingCompleted: false,
  emailNotifications: false,
  pushNotifications: false,
  rememberMe: false,
};

export const createPreferencesSlice: StateCreator<
  RootState,
  [],
  [],
  PreferencesState
> = set => ({
  preferences: {...initialPreferencesState},

  setTheme: theme =>
    set(state => ({
      preferences: {
        ...state.preferences,
        theme,
      },
    })),

  setOnBoardingCompleted: completed =>
    set(state => ({
      preferences: {
        ...state.preferences,
        onBoardingCompleted: completed,
      },
    })),

  setLanguage: language =>
    set(state => ({
      preferences: {
        ...state.preferences,
        language,
      },
    })),

  setNotificationsEnabled: enabled =>
    set(state => ({
      preferences: {
        ...state.preferences,
        emailNotifications: enabled,
        pushNotifications: enabled,
      },
    })),

  updatePreferences: prefs =>
    set(state => ({
      preferences: {
        ...state.preferences,
        ...prefs,
      },
    })),
});
