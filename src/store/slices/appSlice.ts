import {StateCreator} from 'zustand';
import {RootState} from '../index';
import {zustandStorage, STORAGE_KEY} from '../../storage/mmkv';

interface Unit {
  id: string;
  name: string;
  symbol: string;
  abbreviation?: string;
}

// Navigation state machine for explicit flow control
export type NavigationState =
  | 'loading'           // App is loading/hydrating
  | 'auth'              // User needs to authenticate
  | 'verification'      // Email verification needed
  | 'biometric_setup'   // Post-login biometric setup
  | 'onboarding'        // User onboarding flow
  | 'main_app';         // Fully authenticated main app

export interface AppState {
  isHydrated: boolean;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isLoggingOut: boolean; // Global logout state

  // Navigation state machine
  navigationState: NavigationState;
  showBiometricSetup: boolean; // Controls biometric setup modal

  // Post-login biometric credentials (temporary storage for biometric setup)
  postLoginCredentials: { email: string; password: string } | null;

  // Registration password (temporary storage during onboarding for biometric setup)
  registrationPassword: string | null;

  cachedUnits: Unit[];

  setHydrated: (flag: boolean) => void;
  setLoading: (flag: boolean) => void;
  setFetching: (flag: boolean) => void;
  setError: (flag: boolean) => void;
  setLoggingOut: (flag: boolean) => void;

  // Navigation state actions
  setNavigationState: (state: NavigationState) => void;
  setShowBiometricSetup: (flag: boolean) => void;
  setPostLoginCredentials: (credentials: { email: string; password: string } | null) => void;

  // Registration password actions
  setRegistrationPassword: (password: string | null) => void;
  clearRegistrationPassword: () => void;

  setCachedUnits: (units: Unit[]) => void;
  reset: () => void;
}

export const initialAppState = {
  isHydrated: false,
  isLoading: false,
  isError: false,
  isFetching: false,
  isLoggingOut: false,

  // Navigation state machine
  navigationState: 'loading' as NavigationState,
  showBiometricSetup: false,
  postLoginCredentials: null,
  registrationPassword: null,

  cachedUnits: [],
};

export const createAppSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  AppState
> = set => ({
  ...initialAppState,

  setHydrated: flag => set({isHydrated: flag}),
  setLoading: flag => set({isLoading: flag}),
  setFetching: flag => set({isFetching: flag}),
  setError: flag => set({isError: flag}),
  setLoggingOut: flag => set({isLoggingOut: flag}),

  // Navigation state actions
  setNavigationState: (state: NavigationState) => {
    set({navigationState: state});
  },
  setShowBiometricSetup: flag => {
    set({showBiometricSetup: flag});
  },
  setPostLoginCredentials: credentials => {
    set({postLoginCredentials: credentials});
  },

  // Registration password actions
  setRegistrationPassword: password => {
    set({registrationPassword: password});
  },
  clearRegistrationPassword: () => {
    set({registrationPassword: null});
  },

  setCachedUnits: units => set({cachedUnits: units}),

  reset: () => {
    zustandStorage.removeItem(STORAGE_KEY);
    set(initialAppState);
    set({
      itemsById: {},
      itemIds: [],
      pantryById: {},
      pantryIds: [],
      listById: {},
      listIds: [],
      itemsByList: {},
      user: null,
      accessToken: null,
      refreshToken: null,
      navigationState: 'auth', // After reset, user needs to authenticate
      showBiometricSetup: false,
      registrationPassword: null,
    } as unknown as Partial<RootState>);
    set({isHydrated: true});
  },
});
