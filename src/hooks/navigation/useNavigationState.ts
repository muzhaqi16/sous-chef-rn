import {useStore} from '#store';
import {useMemo, useEffect, useCallback, useState} from 'react';
import {hasCredentials} from '#/storage/keychain';

export enum NavigationState {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  NEEDS_VERIFICATION = 'NEEDS_VERIFICATION',
  NEEDS_ONBOARDING = 'NEEDS_ONBOARDING',
  AUTHENTICATED = 'AUTHENTICATED',
  LOADING = 'LOADING',
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

  const navigationState = useMemo(() => {
    if (!isHydrated) return NavigationState.LOADING;
    // Wait for credential check to complete for unauthenticated users
    if (!user && hasStoredCredentials === null) return NavigationState.LOADING;
    if (!user) return NavigationState.UNAUTHENTICATED;
    if (!user.emailVerified) return NavigationState.NEEDS_VERIFICATION;
    if (!user.onBoarded) return NavigationState.NEEDS_ONBOARDING;
    return NavigationState.AUTHENTICATED;
  }, [user, isHydrated, hasStoredCredentials]);

  const getTargetRoute = useCallback(() => {
    switch (navigationState) {
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
  }, [navigationState]);

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

  const readyState = isHydrated && (user || hasStoredCredentials !== null);

  return {
    navigationState,
    targetRoute: getTargetRoute(),
    authStackInitialRoute: readyState ? getAuthStackInitialRoute() : 'Login', // Only compute when ready
    onboardingInitialRoute: getOnboardingInitialRoute(),
    isReady: readyState,
    saveUserProgress,
    hasStoredCredentials,
  };
};
