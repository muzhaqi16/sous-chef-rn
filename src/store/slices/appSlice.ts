import { StateCreator } from 'zustand';
import { RootState } from '../index';

interface Unit {
  id: string;
  name: string;
  symbol: string;
  abbreviation?: string;
}

// Navigation state machine for explicit flow control
export type NavigationState =
  | 'loading' // App is loading/hydrating
  | 'auth' // User needs to authenticate
  | 'verification' // Email verification needed
  | 'biometric_setup' // Post-login biometric setup
  | 'onboarding' // User onboarding flow
  | 'main_app'; // Fully authenticated main app

export interface AppState {
  isHydrated: boolean;
  // NOTE: isLoading, isError, isFetching are owned by uiSlice — do NOT duplicate here
  isLoggingOut: boolean; // Global logout state

  // Navigation state machine
  navigationState: NavigationState;
  showBiometricSetup: boolean; // Controls biometric setup modal

  // Post-login biometric credentials (temporary storage for biometric setup)
  postLoginCredentials: { email: string; password: string } | null;

  // Registration password (temporary storage during onboarding for biometric setup)
  registrationPassword: string | null;

  cachedUnits: Unit[];
  lastUnitsFetchedAt: number | null;

  setHydrated: (flag: boolean) => void;
  setLoggingOut: (flag: boolean) => void;

  // Navigation state actions
  setNavigationState: (state: NavigationState) => void;
  setShowBiometricSetup: (flag: boolean) => void;
  setPostLoginCredentials: (
    credentials: { email: string; password: string } | null,
  ) => void;

  // Registration password actions
  setRegistrationPassword: (password: string | null) => void;
  clearRegistrationPassword: () => void;

  setCachedUnits: (units: Unit[]) => void;
  setLastUnitsFetchedAt: (timestamp: number) => void;
}

export const initialAppState = {
  isHydrated: false,
  isLoggingOut: false,

  // Navigation state machine
  navigationState: 'loading' as NavigationState,
  showBiometricSetup: false,
  postLoginCredentials: null,
  registrationPassword: null,

  cachedUnits: [],
  lastUnitsFetchedAt: null,
};

export const createAppSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  AppState
> = set => ({
  ...initialAppState,

  setHydrated: flag => set({ isHydrated: flag }),
  setLoggingOut: flag => set({ isLoggingOut: flag }),

  // Navigation state actions
  setNavigationState: (state: NavigationState) => {
    set({ navigationState: state });
  },
  setShowBiometricSetup: flag => {
    set({ showBiometricSetup: flag });
  },
  setPostLoginCredentials: credentials => {
    set({ postLoginCredentials: credentials });
  },

  // Registration password actions
  setRegistrationPassword: password => {
    set({ registrationPassword: password });
  },
  clearRegistrationPassword: () => {
    set({ registrationPassword: null });
  },

  setCachedUnits: units => set({ cachedUnits: units }),
  setLastUnitsFetchedAt: timestamp => set({ lastUnitsFetchedAt: timestamp }),
});
