// ============================================
// store/slices/navigationSlice.ts
// Navigation and onboarding state
// ============================================

import {StateCreator} from 'zustand';
import {RootState} from '../index';

export interface DeepLinkAction {
  type: 'email_verification' | 'password_reset' | 'accept_invitation';
  token: string;
  timestamp: number;
}

export enum OnBoardingSteps {
  createHome = 'createHome',
  createShoppingList = 'createShoppingList',
  selectPantryItems = 'selectPantryItems',
  profilePictureUpload = 'profilePictureUpload',
  inviteMembers = 'inviteMembers',
  complete = 'complete',
}

interface UserNavigationState {
  lastRoute?: string;
  onboardingProgress?: string;
  lastLoginTimestamp?: number;
  rememberMeChoice?: boolean;
  hasCompletedOnboarding?: boolean;
  onboardingStartedAt?: number;
  onboardingCompletedAt?: number;
  skippedOnboardingSteps?: string[];
  isNewUser?: boolean;
  biometricSetupOffered?: boolean;
  biometricEnabled?: boolean;
  // Post-login biometric prompt tracking
  postLoginBiometricPromptShown?: boolean;
  postLoginBiometricPromptCount?: number;
  lastBiometricPromptDeclined?: number;
  biometricPromptRemindLater?: boolean;
  // Enhanced authentication flow tracking
  biometricDeclinedPermanently?: boolean;
  credentialPromptDeclined?: boolean;
  lastCredentialPromptShown?: number;
}

export interface NavigationState {
  // Onboarding
  onBoardingStep: OnBoardingSteps | null;

  // Selected resources
  selectedHomeId: string | null;
  selectedPantryId: string | null;
  selectedShoppingListId: string | null;

  // User-specific navigation states
  userNavigationStates: Record<string, UserNavigationState>;

  // Deep link state
  pendingDeepLinkAction: DeepLinkAction | null;

  // Actions
  setOnBoardingStep: (step: OnBoardingSteps | null) => void;
  setSelectedHomeId: (id: string | null) => void;
  setSelectedPantryId: (id: string | null) => void;
  setSelectedShoppingListId: (id: string | null) => void;
  setUserNavigationState: (
    userId: string,
    state: Partial<UserNavigationState>,
  ) => void;
  getUserNavigationState: (userId: string) => UserNavigationState | null;
  clearUserNavigationState: (userId: string) => void;
  setPendingDeepLinkAction: (action: DeepLinkAction | null) => void;
  clearPendingDeepLinkAction: () => void;
}

const initialNavigationState = {
  onBoardingStep: null,
  selectedHomeId: null,
  selectedPantryId: null,
  selectedShoppingListId: null,
  userNavigationStates: {},
  pendingDeepLinkAction: null,
};

export const createNavigationSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  NavigationState
> = (set, get) => ({
  ...initialNavigationState,

  setOnBoardingStep: step => {
    set(state => {
      state.onBoardingStep = step;
    });
  },

  setSelectedHomeId: id => {
    set(state => {
      state.selectedHomeId = id;
    });
  },

  setSelectedPantryId: id => {
    set(state => {
      state.selectedPantryId = id;
    });
  },

  setSelectedShoppingListId: id => {
    set(state => {
      state.selectedShoppingListId = id;
    });
  },

  setUserNavigationState: (userId, navState) => {
    set(state => {
      if (!state.userNavigationStates[userId]) {
        state.userNavigationStates[userId] = {};
      }
      Object.assign(state.userNavigationStates[userId], navState);
    });
  },

  getUserNavigationState: userId => {
    const state = get();
    return state.userNavigationStates[userId] || null;
  },

  clearUserNavigationState: userId => {
    set(state => {
      delete state.userNavigationStates[userId];
    });
  },

  setPendingDeepLinkAction: action => {
    set(state => {
      state.pendingDeepLinkAction = action;
    });
  },

  clearPendingDeepLinkAction: () => {
    set(state => {
      state.pendingDeepLinkAction = null;
    });
  },
});
