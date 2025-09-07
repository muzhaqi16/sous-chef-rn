import {StateCreator} from 'zustand';
import {RootState} from '../index';

export enum OnBoardingSteps {
  createHome = 'createHome',
  createShoppingList = 'createShoppingList',
  selectPantryItems = 'selectPantryItems',
  profilePictureUpload = 'profilePictureUpload',
  inviteMembers = 'inviteMembers',
  complete = 'complete',
}

export interface PreferencesState {
  // Theme - now supports 'system' option
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Language
  language?: string;
  setLanguage: (language: string) => void;
  // Onboarding
  onBoardingStep: OnBoardingSteps | null;
  setOnBoardingStep: (step: OnBoardingSteps) => void;

  // Notifications
  emailNotifications: boolean;
  pushNotifications: boolean;
  setEmailNotifications: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;

  // Remember Me
  rememberMe?: boolean; // undefined means "haven't asked yet"
  setRememberMe: (remember: boolean) => void;

  // Selected IDs for onboarding
  selectedHomeId: string | null;
  setSelectedHomeId: (id: string | null) => void;

  selectedPantryId: string | null;
  setSelectedPantryId: (id: string | null) => void;

  selectedShoppingListId: string | null;
  setSelectedShoppingListId: (id: string | null) => void;

  // Reset function
  resetOnboarding: () => void;
  resetPreferences: () => void;

  // Reset all preferences
  reset: () => void;
}

const initialPreferencesState: Omit<
  PreferencesState,
  | 'setTheme'
  | 'setLanguage'
  | 'setOnBoardingStep'
  | 'setEmailNotifications'
  | 'setNotificationsEnabled'
  | 'setRememberMe'
  | 'setSelectedHomeId'
  | 'setSelectedPantryId'
  | 'setSelectedShoppingListId'
  | 'resetOnboarding'
  | 'resetPreferences'
  | 'reset'
> = {
  theme: 'system', // Default to system preference
  onBoardingStep: null,
  language: undefined,
  emailNotifications: false,
  pushNotifications: false,
  rememberMe: undefined,
  selectedShoppingListId: null,
  selectedPantryId: null,
  selectedHomeId: null,
};

export const createPreferencesSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  PreferencesState
> = (set, get) => ({
  ...initialPreferencesState,
  setTheme: theme => set({theme}),

  setLanguage: language => set({language}),

  setOnBoardingStep: step => set({onBoardingStep: step}),

  setSelectedHomeId: id => set({selectedHomeId: id}),

  setSelectedPantryId: id => set({selectedPantryId: id}),

  setSelectedShoppingListId: id => set({selectedShoppingListId: id}),

  resetOnboarding: () =>
    set({
      onBoardingStep: null,
      selectedHomeId: null,
      selectedPantryId: null,
      selectedShoppingListId: null,
    }),
  resetPreferences: () =>
    set({
      ...initialPreferencesState,
      selectedHomeId: get().selectedHomeId, // Keep the selected home ID
      selectedPantryId: get().selectedPantryId, // Keep the selected pantry ID
      selectedShoppingListId: get().selectedShoppingListId, // Keep the selected shopping list ID
    }),
  setEmailNotifications: enabled => set({emailNotifications: enabled}),
  setNotificationsEnabled: enabled => set({pushNotifications: enabled}),
  setRememberMe: remember => set({rememberMe: remember}),

  // Reset function to clear all preferences
  reset: () => set(initialPreferencesState),
});
