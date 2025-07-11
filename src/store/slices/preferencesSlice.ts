// src/store/slices/preferencesSlice.ts
import {StateCreator} from 'zustand';
import {RootState} from '../index';

type OnBoardingSteps = 'createShoppingList' | 'selectPantryItems' | null;

export const OnBoardingSteps = {
  createShoppingList: 'createShoppingList' as OnBoardingSteps,
  selectPantryItems: 'selectPantryItems' as OnBoardingSteps,
  null: null as OnBoardingSteps,
};

export interface PreferencesState {
  theme: 'light' | 'dark';
  onBoardingCompleted: boolean;
  onBoardingStep: OnBoardingSteps;
  language?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  /** true = user asked “yes”, false = user asked “no”, undefined = not yet asked */
  rememberMe?: boolean;
  selectedShoppingListId: string | null;
  selectedPantryId: string | null;

  setRememberMe: (remember: boolean) => void;
  setEmailNotifications: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setSelectedShoppingListId: (id: string | null) => void;
  setSelectedPantryId: (id: string | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setOnBoardingCompleted: (completed: boolean) => void;
  setOnBoardingStep: (step: OnBoardingSteps) => void;
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
  | 'setSelectedPantryId'
  | 'setTheme'
  | 'setOnBoardingCompleted'
  | 'setOnBoardingStep'
  | 'setLanguage'
  | 'resetPreferences'
  | 'updatePreferences'
  | 'reset'
  | 'hydrate'
> = {
  theme: 'light',
  onBoardingCompleted: false,
  onBoardingStep: null,
  language: undefined,
  emailNotifications: false,
  pushNotifications: false,
  rememberMe: undefined, // ← start as “haven’t asked yet”
  selectedShoppingListId: null,
  selectedPantryId: null,
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
  setSelectedPantryId: id =>
    set(draft => {
      draft.selectedPantryId = id;
    }),

  setTheme: theme =>
    set(draft => {
      draft.theme = theme;
    }),

  setOnBoardingCompleted: completed =>
    set(draft => {
      draft.onBoardingCompleted = completed;
    }),

  setOnBoardingStep: step =>
    set(draft => {
      draft.onBoardingStep = step;
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
      if (updates.selectedPantryId === undefined) {
        draft.selectedPantryId = get().selectedPantryId;
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
      if (preferences.selectedPantryId === undefined) {
        draft.selectedPantryId = get().selectedPantryId;
      }
    }),
});
