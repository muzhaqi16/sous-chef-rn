import {useStore} from '#store';
import {useMemo, useEffect, useCallback, useState, useRef} from 'react';
import {hasCredentials} from '#/storage/keychain';

export enum NavigationState {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  NEEDS_VERIFICATION = 'NEEDS_VERIFICATION', 
  NEEDS_ONBOARDING = 'NEEDS_ONBOARDING',
  AUTHENTICATED = 'AUTHENTICATED',
  LOADING = 'LOADING',
  LOGGING_OUT = 'LOGGING_OUT',
}

// Navigation state machine transition map - defines valid state changes
export const NAVIGATION_TRANSITIONS: Record<NavigationState, NavigationState[]> = {
  [NavigationState.LOADING]: [
    NavigationState.UNAUTHENTICATED,
    NavigationState.AUTHENTICATED,
    NavigationState.NEEDS_VERIFICATION,
    NavigationState.NEEDS_ONBOARDING,
  ],
  [NavigationState.UNAUTHENTICATED]: [
    NavigationState.LOADING,
    NavigationState.NEEDS_VERIFICATION,
    NavigationState.NEEDS_ONBOARDING,
    NavigationState.AUTHENTICATED,
  ],
  [NavigationState.NEEDS_VERIFICATION]: [
    NavigationState.UNAUTHENTICATED,
    NavigationState.NEEDS_ONBOARDING,
    NavigationState.AUTHENTICATED,
    NavigationState.LOGGING_OUT,
  ],
  [NavigationState.NEEDS_ONBOARDING]: [
    NavigationState.UNAUTHENTICATED,
    NavigationState.AUTHENTICATED,
    NavigationState.LOGGING_OUT,
  ],
  [NavigationState.AUTHENTICATED]: [
    NavigationState.UNAUTHENTICATED,
    NavigationState.LOADING,
    NavigationState.LOGGING_OUT,
  ],
  [NavigationState.LOGGING_OUT]: [
    NavigationState.UNAUTHENTICATED,
    NavigationState.LOADING,
  ],
};

// Transition event types for better debugging
export type NavigationTransitionEvent = 
  | 'APP_HYDRATED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE' 
  | 'LOGOUT'
  | 'LOGOUT_INITIATED'
  | 'LOGOUT_COMPLETED'
  | 'EMAIL_VERIFIED'
  | 'ONBOARDING_COMPLETED'
  | 'SESSION_EXPIRED'
  | 'FORCE_REFRESH';

interface NavigationTransition {
  from: NavigationState;
  to: NavigationState;
  event: NavigationTransitionEvent;
  timestamp: number;
}

interface UserNavigationState {
  lastRoute?: string;
  onboardingProgress?: string;
  lastLoginTimestamp?: number;
  rememberMeChoice?: boolean;
}

export const useNavigationState = () => {
  const {
    user,
    isHydrated,
    rememberMe,
    onBoardingStep,
    setUserNavigationState,
    getUserNavigationState,
  } = useStore();

  const [hasStoredCredentials, setHasStoredCredentials] = useState<boolean | null>(null);
  
  // State machine state tracking
  const [currentNavigationState, setCurrentNavigationState] = useState<NavigationState>(NavigationState.LOADING);
  const transitionHistoryRef = useRef<NavigationTransition[]>([]);
  const lastTransitionRef = useRef<NavigationTransition | null>(null);

  // State machine transition validation
  const canTransitionTo = useCallback((newState: NavigationState): boolean => {
    const validTransitions = NAVIGATION_TRANSITIONS[currentNavigationState];
    return validTransitions.includes(newState);
  }, [currentNavigationState]);

  // Controlled state transition with validation
  const transitionTo = useCallback((
    newState: NavigationState, 
    event: NavigationTransitionEvent,
    force = false
  ): boolean => {
    // Allow forced transitions for error recovery
    if (!force && !canTransitionTo(newState)) {
      console.warn(
        `[NavigationStateMachine] Invalid transition from ${currentNavigationState} to ${newState} via ${event}`
      );
      return false;
    }

    const transition: NavigationTransition = {
      from: currentNavigationState,
      to: newState,
      event,
      timestamp: Date.now(),
    };

    // Update state
    setCurrentNavigationState(newState);
    lastTransitionRef.current = transition;
    
    // Keep transition history (last 10 transitions for debugging)
    transitionHistoryRef.current = [
      transition,
      ...transitionHistoryRef.current.slice(0, 9),
    ];

    console.log(
      `[NavigationStateMachine] ${transition.from} → ${transition.to} (${event})`
    );

    return true;
  }, [currentNavigationState, canTransitionTo]);

  // Check for stored credentials on hydration
  useEffect(() => {
    if (isHydrated && !user) {
      const checkCredentials = async () => {
        try {
          const hasCreds = await hasCredentials();
          setHasStoredCredentials(hasCreds);
        } catch (error) {
          console.error('Error checking stored credentials:', error);
          setHasStoredCredentials(false);
        }
      };
      checkCredentials();
    } else if (user) {
      // If user is already logged in, we don't need to check credentials
      setHasStoredCredentials(null);
    }
  }, [isHydrated, user]);

  // Load user-specific navigation state
  useEffect(() => {
    if (user?.id) {
      getUserNavigationState(user.id);
    }
  }, [user?.id]);

  // Enhanced navigation state computation with automatic transitions
  const computedNavigationState = useMemo(() => {
    if (!isHydrated) return NavigationState.LOADING;
    // Wait for credential check to complete for unauthenticated users
    if (!user && hasStoredCredentials === null) return NavigationState.LOADING;
    if (!user) return NavigationState.UNAUTHENTICATED;
    if (!user.emailVerified) return NavigationState.NEEDS_VERIFICATION;
    if (!user.onBoarded) return NavigationState.NEEDS_ONBOARDING;
    return NavigationState.AUTHENTICATED;
  }, [user, isHydrated, hasStoredCredentials]);

  // Automatically transition to computed state when conditions change
  useEffect(() => {
    if (computedNavigationState !== currentNavigationState) {
      let event: NavigationTransitionEvent;
      
      // Determine the event that caused this state change
      if (!isHydrated && currentNavigationState === NavigationState.LOADING) {
        return; // Still loading, no transition needed
      } else if (isHydrated && currentNavigationState === NavigationState.LOADING) {
        event = 'APP_HYDRATED';
      } else if (user && currentNavigationState === NavigationState.UNAUTHENTICATED) {
        event = 'LOGIN_SUCCESS';
      } else if (!user && currentNavigationState !== NavigationState.LOADING) {
        event = 'LOGOUT';
      } else if (user?.emailVerified && currentNavigationState === NavigationState.NEEDS_VERIFICATION) {
        event = 'EMAIL_VERIFIED';
      } else if (user?.onBoarded && currentNavigationState === NavigationState.NEEDS_ONBOARDING) {
        event = 'ONBOARDING_COMPLETED';
      } else {
        event = 'FORCE_REFRESH';
      }

      transitionTo(computedNavigationState, event);
    }
  }, [computedNavigationState, currentNavigationState, isHydrated, user, transitionTo]);

  const getTargetRoute = useCallback(() => {
    switch (currentNavigationState) {
      case NavigationState.UNAUTHENTICATED:
        return 'AuthStack';
      case NavigationState.NEEDS_VERIFICATION:
        return 'AuthStack'; // CodeVerification is inside AuthStack
      case NavigationState.NEEDS_ONBOARDING:
        return 'OnBoardingStack';
      case NavigationState.AUTHENTICATED:
        return 'HomeStack';
      default:
        return 'AuthStack';
    }
  }, [currentNavigationState]);

  const getAuthStackInitialRoute = useCallback(() => {
    if (!user) {
      // For unauthenticated users, decide based on whether they've used the app before
      if (hasStoredCredentials === true) {
        // User has used the app before and has saved credentials - go directly to Login
        return 'Login';
      } else if (hasStoredCredentials === false) {
        // No stored credentials - check if they've set a remember preference
        return rememberMe === undefined ? 'LandingAuth' : 'Login';
      }
      // Still checking credentials - return Login silently (AuthStack will handle the actual logic)
      return 'Login';
    }
    if (!user.emailVerified) {
      return 'CodeVerification';
    }
    return 'Login';
  }, [user, rememberMe, hasStoredCredentials]);

  const getOnboardingInitialRoute = useCallback(() => {
    if (user?.onBoarded) {
      return 'OnboardingComplete';
    }

    // Get user-specific onboarding progress
    const userNavState = user?.id ? getUserNavigationState(user.id) : null;
    const savedStep = userNavState?.onboardingProgress || onBoardingStep;

    switch (savedStep) {
      case 'createShoppingList':
        return 'CreateShoppingList';
      case 'selectPantryItems':
        return 'SelectPantryItems';
      case 'profilePictureUpload':
        return 'ProfilePictureUpload';
      case 'inviteMembers':
        return 'InviteMembers';
      case 'complete':
        return 'OnboardingComplete';
      default:
        return 'CreateHome';
    }
  }, [user, getUserNavigationState, onBoardingStep]);

  const saveUserProgress = useCallback(
    (progressData: Partial<UserNavigationState>) => {
      if (user?.id) {
        setUserNavigationState(user.id, progressData);
      }
    },
    [user?.id, setUserNavigationState],
  );

  // Developer tools for debugging
  const getTransitionHistory = useCallback(() => {
    return transitionHistoryRef.current;
  }, []);

  const getStateMachineInfo = useCallback(() => {
    return {
      currentState: currentNavigationState,
      possibleTransitions: NAVIGATION_TRANSITIONS[currentNavigationState],
      lastTransition: lastTransitionRef.current,
      transitionHistory: transitionHistoryRef.current,
    };
  }, [currentNavigationState]);

  // Force transition for error recovery
  const forceTransition = useCallback((
    newState: NavigationState,
    reason = 'Manual override'
  ) => {
    return transitionTo(newState, 'FORCE_REFRESH', true);
  }, [transitionTo]);

  // Initiate logout process
  const initiateLogout = useCallback(() => {
    return transitionTo(NavigationState.LOGGING_OUT, 'LOGOUT_INITIATED');
  }, [transitionTo]);

  // Complete logout process
  const completeLogout = useCallback(() => {
    return transitionTo(NavigationState.UNAUTHENTICATED, 'LOGOUT_COMPLETED');
  }, [transitionTo]);

  const readyState = isHydrated && (user || hasStoredCredentials !== null);

  return {
    navigationState: currentNavigationState,
    targetRoute: getTargetRoute(),
    authStackInitialRoute: readyState ? getAuthStackInitialRoute() : 'Login',
    onboardingInitialRoute: getOnboardingInitialRoute(),
    isReady: readyState,
    saveUserProgress,
    hasStoredCredentials,
    
    // State machine methods
    canTransitionTo,
    transitionTo,
    forceTransition,
    initiateLogout,
    completeLogout,
    
    // Developer tools
    getTransitionHistory,
    getStateMachineInfo,
    
    // Computed state for comparison
    computedState: computedNavigationState,
  };
};
