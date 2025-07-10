// src/store/slices/preferencesSlice.ts
import {StateCreator} from 'zustand';
import {RootState} from '../index';

export interface PreferencesState {
  theme: 'light' | 'dark';
  onBoardingCompleted: boolean;
  language?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  rememberMe?: boolean;
  selectedShoppingListId: string | null;

  setRememberMe: (remember: boolean) => void;
  setEmailNotifications: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setSelectedShoppingListId: (id: string | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setOnBoardingCompleted: (completed: boolean) => void;
  setLanguage: (language: string) => void;

  resetPreferences: () => void;
  updatePreferences: (updates: Partial<PreferencesState>) => void;
  reset: () => void;
  hydrate: (preferences: Partial<PreferencesState>) => void;
}

const initialPreferencesState: Omit<
  PreferencesState,
  | 'setRememberMe'
  | 'setEmailNotifications'
  | 'setNotificationsEnabled'
  | 'setSelectedShoppingListId'
  | 'setTheme'
  | 'setOnBoardingCompleted'
  | 'setLanguage'
  | 'resetPreferences'
  | 'updatePreferences'
  | 'reset'
  | 'hydrate'
> = {
  theme: 'light',
  onBoardingCompleted: false,
  language: undefined,
  emailNotifications: false,
  pushNotifications: false,
  rememberMe: false,
  selectedShoppingListId: null,
};

export const createPreferencesSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  PreferencesState
> = (set, get) => ({
  ...initialPreferencesState,

  setRememberMe: remember =>
    set(draft => {
      draft.rememberMe = remember;
    }),

  setEmailNotifications: enabled =>
    set(draft => {
      draft.emailNotifications = enabled;
    }),

  setNotificationsEnabled: enabled =>
    set(draft => {
      draft.emailNotifications = enabled;
      draft.pushNotifications = enabled;
    }),

  setSelectedShoppingListId: id =>
    set(draft => {
      draft.selectedShoppingListId = id;
    }),

  setTheme: theme =>
    set(draft => {
      draft.theme = theme;
    }),

  setOnBoardingCompleted: completed =>
    set(draft => {
      draft.onBoardingCompleted = completed;
    }),

  setLanguage: language =>
    set(draft => {
      draft.language = language;
    }),

  resetPreferences: () =>
    set(() => ({
      ...initialPreferencesState,
      selectedShoppingListId: null,
    })),

  updatePreferences: updates =>
    set(draft => {
      Object.assign(draft, updates);
      // ensure we never lose the selectedShoppingListId unless explicitly provided
      if (updates.selectedShoppingListId === undefined) {
        draft.selectedShoppingListId = get().selectedShoppingListId;
      }
    }),

  reset: () =>
    set(() => ({
      ...initialPreferencesState,
      selectedShoppingListId: null,
    })),

  hydrate: preferences =>
    // This is used to hydrate the preferences from storage
    // so we ensure we don't lose the selectedShoppingListId
    set(draft => {
      Object.assign(draft, preferences);
      if (preferences.selectedShoppingListId === undefined) {
        draft.selectedShoppingListId = get().selectedShoppingListId;
      }
    }),
});
