// ============================================
// store/slices/navigationSlice.ts
// Navigation and onboarding state
// ============================================

import { StateCreator } from 'zustand';
import { RootState } from '../index';

/**
 * A deep-link intent queued while the app is hydrating or the user is logged
 * out, replayed by `useDeepLinkRouter` once conditions are met.
 *
 * Two shapes: JWT-token actions (auth lifecycle + person-specific invites) and
 * share-code actions (anyone-with-link joins). Codes are not JWTs, so they skip
 * `validateDeepLinkToken`.
 */
export interface TokenDeepLinkAction {
  type: 'email_verification' | 'password_reset' | 'accept_invitation';
  token: string;
  timestamp: number;
}

export interface CodeDeepLinkAction {
  type: 'join_home' | 'join_list';
  code: string;
  timestamp: number;
}

export type DeepLinkAction = TokenDeepLinkAction | CodeDeepLinkAction;

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
  // User chose "skip for now" on the email verification screen. Lets an
  // unverified account reach the app instead of being parked on a screen it
  // can't leave when the verification email never arrives. Cleared on every
  // interactive login so each new session prompts once more.
  verificationSkipped?: boolean;
}

export interface NavigationState {
  // Onboarding navigation state — source of truth for "which onboarding screen
  // is current". Persisted across app restarts so a user mid-onboarding lands
  // back on the same step. Distinct from OnboardingContext.activeStepIndex,
  // which is a session-only Reanimated SharedValue driving the progress-bar
  // animation. Both update together via useOnboardingNavigation; the store is
  // the persistent state, the context is the animation driver.
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
