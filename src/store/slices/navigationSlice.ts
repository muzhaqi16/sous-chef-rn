// ============================================
// store/slices/navigationSlice.ts
// Navigation and onboarding state
// ============================================

import { StateCreator } from 'zustand';
import { RootState } from '../index';

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
  selectedMealPlanId: string | null;

  // Home data initialization flag (survives component remounts)
  hasInitializedHomeData: boolean;

  // Home selection ready flag - true when home selection is complete and valid
  // Gates pantry queries to prevent race conditions on first login
  isHomeSelectionReady: boolean;

  // Set to true once GetPantry first settles — gates GetCommonUnits preload
  isPantryQueryComplete: boolean;

  // User-specific navigation states
  userNavigationStates: Record<string, UserNavigationState>;

  // Deep link state
  pendingDeepLinkAction: DeepLinkAction | null;

  // Actions
  setOnBoardingStep: (step: OnBoardingSteps | null) => void;
  setSelectedHomeId: (id: string | null) => void;
  setSelectedPantryId: (id: string | null) => void;
  setSelectedShoppingListId: (id: string | null) => void;
  setSelectedMealPlanId: (id: string | null) => void;
  setHasInitializedHomeData: (value: boolean) => void;
  setIsHomeSelectionReady: (value: boolean) => void;
  setIsPantryQueryComplete: (value: boolean) => void;
  setHomeAndPantry: (homeId: string | null, pantryId: string | null) => void;
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
  selectedMealPlanId: null,
  hasInitializedHomeData: false,
  isHomeSelectionReady: false,
  isPantryQueryComplete: false,
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

  setSelectedMealPlanId: id => {
    set(state => {
      state.selectedMealPlanId = id;
    });
  },

  // Atomic update for home and pantry to prevent race conditions
  // When switching homes, both values must update in a single re-render
  setHomeAndPantry: (homeId, pantryId) => {
    set(state => {
      state.selectedHomeId = homeId;
      state.selectedPantryId = pantryId;
    });
  },

  setHasInitializedHomeData: value => {
    set(state => {
      state.hasInitializedHomeData = value;
    });
  },

  setIsHomeSelectionReady: value => {
    set(state => {
      state.isHomeSelectionReady = value;
    });
  },

  setIsPantryQueryComplete: value => {
    set(state => {
      state.isPantryQueryComplete = value;
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
