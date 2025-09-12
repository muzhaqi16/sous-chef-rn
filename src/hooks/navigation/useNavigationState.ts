import {useStore} from '#store';
import {useMemo, useEffect, useCallback, useState} from 'react';
import {hasCredentials} from '#/storage/keychain';

export enum NavigationState {
  LOADING = 'LOADING',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  NEEDS_VERIFICATION = 'NEEDS_VERIFICATION',
  NEEDS_ONBOARDING = 'NEEDS_ONBOARDING',
  AUTHENTICATED = 'AUTHENTICATED',
}

interface UserProgress {
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

  const [hasStoredCredentials, setHasStoredCredentials] = useState<
    boolean | null
  >(null);

  // Check for stored credentials
  useEffect(() => {
    if (!isHydrated) return;

    if (user) {
      setHasStoredCredentials(null); // Not needed when user is logged in
      return;
    }

    hasCredentials()
      .then(setHasStoredCredentials)
      .catch(() => setHasStoredCredentials(false));
  }, [isHydrated, user]);

  // Compute the current navigation state with strict checks
  const navigationState = useMemo(() => {
    // Always return loading if not hydrated
    if (!isHydrated) {
      return NavigationState.LOADING;
    }

    // If checking for stored credentials, stay in loading
    if (!user && hasStoredCredentials === null) {
      return NavigationState.LOADING;
    }

    // No user means unauthenticated
    if (!user) {
      return NavigationState.UNAUTHENTICATED;
    }

    // IMPORTANT: Check email verification first
    if (!user.emailVerified) {
      return NavigationState.NEEDS_VERIFICATION;
    }

    // IMPORTANT: Explicitly check onBoarded flag
    // Treat undefined, null, or false as not onboarded
    if (user.onBoarded !== true) {
      return NavigationState.NEEDS_ONBOARDING;
    }

    // Only return authenticated if all checks pass
    return NavigationState.AUTHENTICATED;
  }, [user, isHydrated, hasStoredCredentials]);

  // Get target route based on navigation state with defensive checks
  const targetRoute = useMemo(() => {
    switch (navigationState) {
      case NavigationState.LOADING:
        return null; // Don't navigate while loading
      case NavigationState.NEEDS_VERIFICATION:
      case NavigationState.UNAUTHENTICATED:
        return 'AuthStack';
      case NavigationState.NEEDS_ONBOARDING:
        return 'OnBoardingStack';
      case NavigationState.AUTHENTICATED:
        return 'HomeStack';
      default:
        return 'AuthStack';
    }
  }, [navigationState]);

  // Get initial route for auth stack
  const getAuthStackInitialRoute = useCallback(() => {
    if (!user) {
      if (hasStoredCredentials === true) return 'Login';
      if (hasStoredCredentials === false) {
        return rememberMe === undefined ? 'LandingAuth' : 'Login';
      }
      return 'Login'; // Default while checking
    }
    if (!user.emailVerified) return 'CodeVerification';
    return 'Login';
  }, [user, rememberMe, hasStoredCredentials]);

  // Get initial route for onboarding stack
  const getOnboardingInitialRoute = useCallback(() => {
    // Defensive check - if somehow onBoarded is true, show complete screen
    if (user?.onBoarded === true) return 'OnboardingComplete';

    const userNavState = user?.id ? getUserNavigationState(user.id) : null;
    const savedStep = userNavState?.onboardingProgress || onBoardingStep;

    const stepToRoute: Record<string, string> = {
      createShoppingList: 'CreateShoppingList',
      selectPantryItems: 'SelectPantryItems',
      profilePictureUpload: 'ProfilePictureUpload',
      inviteMembers: 'InviteMembers',
      complete: 'OnboardingComplete',
    };

    return (savedStep && stepToRoute[savedStep]) || 'CreateHome';
  }, [user, getUserNavigationState, onBoardingStep]);

  // Save user progress helper
  const saveUserProgress = useCallback(
    (progressData: Partial<UserProgress>) => {
      if (user?.id) {
        setUserNavigationState(user.id, progressData);
      }
    },
    [user?.id, setUserNavigationState],
  );

  const isReady = navigationState !== NavigationState.LOADING;

  return {
    // Core navigation state
    navigationState,
    targetRoute,
    isReady,

    // Route helpers
    authStackInitialRoute: isReady ? getAuthStackInitialRoute() : 'Login',
    onboardingInitialRoute: getOnboardingInitialRoute(),

    // User state
    hasStoredCredentials,
    saveUserProgress,
  };
};
