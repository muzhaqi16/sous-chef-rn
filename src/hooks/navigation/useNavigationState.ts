import {useStore} from '#store';
import {useMemo, useEffect} from 'react';

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

  // Load user-specific navigation state
  useEffect(() => {
    if (user?.id) {
      const userNavState = getUserNavigationState(user.id);
      if (userNavState) {
        console.log(
          `Restored navigation state for user ${user.id}:`,
          userNavState,
        );
      }
    }
  }, [user?.id]);

  const navigationState = useMemo(() => {
    if (!isHydrated) return NavigationState.LOADING;
    if (!user) return NavigationState.UNAUTHENTICATED;
    if (!user.emailVerified) return NavigationState.NEEDS_VERIFICATION;
    if (!user.onBoarded) return NavigationState.NEEDS_ONBOARDING;
    return NavigationState.AUTHENTICATED;
  }, [user, isHydrated]);

  const getTargetRoute = () => {
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
  };

  const getAuthStackInitialRoute = () => {
    if (!user) {
      return rememberMe === undefined ? 'LandingAuth' : 'Login';
    }
    if (!user.emailVerified) {
      return 'CodeVerification';
    }
    return 'Login';
  };

  const getOnboardingInitialRoute = () => {
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
      case 'inviteMembers':
        return 'InviteMembers';
      case 'complete':
        return 'OnboardingComplete';
      default:
        return 'CreateHome';
    }
  };

  const saveUserProgress = (progressData: Partial<UserNavigationState>) => {
    if (user?.id) {
      setUserNavigationState(user.id, progressData);
    }
  };

  return {
    navigationState,
    targetRoute: getTargetRoute(),
    authStackInitialRoute: getAuthStackInitialRoute(),
    onboardingInitialRoute: getOnboardingInitialRoute(),
    isReady: isHydrated,
    saveUserProgress,
  };
};
