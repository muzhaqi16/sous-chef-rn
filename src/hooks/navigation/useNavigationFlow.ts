import { useCallback, useRef, useEffect } from 'react';
import { useStore } from '#store';
import { OnBoardingSteps } from '#store/slices/preferencesSlice';
import { useSafeNavigation } from '../useSafeNavigation';
import { useNavigationState, NavigationState } from './useNavigationState';
import { CommonActions } from '@react-navigation/native';
import type { LoginMutation, RegisterMutation } from '#generated';

type AuthUser =
  | NonNullable<LoginMutation['login']>['user']
  | NonNullable<RegisterMutation['register']>['user'];

export interface NavigationRoute {
  stack: 'AuthStack' | 'OnBoardingStack' | 'HomeStack';
  screen?: string;
  params?: any;
  preventGoBack?: boolean;
}

interface NavigationTrigger {
  shouldNavigate: boolean;
  route: NavigationRoute;
  timestamp: number;
}

export const useNavigationFlow = () => {
  const {
    user,
    getUserNavigationState,
    setUserNavigationState,
    setOnBoardingStep,
    onBoardingStep,
  } = useStore();

  const { navigation } = useSafeNavigation();
  const { 
    navigationState, 
    canTransitionTo, 
    transitionTo,
    getStateMachineInfo 
  } = useNavigationState();
  
  const navigationTriggerRef = useRef<NavigationTrigger | null>(null);
  const isNavigatingRef = useRef(false);

  // Central function to determine the correct route based on user state
  const getNavigationRoute = useCallback((
    currentUser: AuthUser | null, 
    hasStoredCredentials?: boolean | null
  ): NavigationRoute => {
    // No user - determine auth route
    if (!currentUser) {
      // If user has stored credentials, skip landing and go to login
      if (hasStoredCredentials === true) {
        return { stack: 'AuthStack', screen: 'Login' };
      }
      // New user or no stored credentials
      return { stack: 'AuthStack', screen: 'LandingAuth' };
    }

    // User exists - check verification status
    if (!currentUser.emailVerified) {
      return { stack: 'AuthStack', screen: 'CodeVerification' };
    }

    // User verified - check onboarding status
    if (!currentUser.onBoarded) {
      const userNavState = getUserNavigationState(currentUser.id);
      const currentStep = userNavState?.onboardingProgress || onBoardingStep;
      
      // Determine onboarding screen based on progress
      let screen = 'CreateHome';
      switch (currentStep) {
        case OnBoardingSteps.createShoppingList:
          screen = 'CreateShoppingList';
          break;
        case OnBoardingSteps.selectPantryItems:
          screen = 'SelectPantryItems';
          break;
        case OnBoardingSteps.profilePictureUpload:
          screen = 'ProfilePictureUpload';
          break;
        case OnBoardingSteps.inviteMembers:
          screen = 'InviteMembers';
          break;
        case OnBoardingSteps.complete:
          screen = 'OnboardingComplete';
          break;
        default:
          screen = 'CreateHome';
      }
      
      return { 
        stack: 'OnBoardingStack', 
        screen, 
        preventGoBack: true 
      };
    }

    // Fully onboarded user
    return { stack: 'HomeStack' };
  }, [getUserNavigationState, onBoardingStep]);

  // Execute navigation immediately using React Navigation events
  const executeNavigation = useCallback((route: NavigationRoute) => {
    if (isNavigatingRef.current) {
      console.log('Navigation already in progress, skipping');
      return;
    }

    isNavigatingRef.current = true;

    try {
      const routes: any[] = [];

      if (route.screen) {
        routes.push({
          name: route.stack,
          params: route.params ? {screen: route.screen, params: route.params} : {screen: route.screen},
        });
      } else {
        routes.push({name: route.stack});
      }

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes,
        })
      );

      console.log(`Navigation executed: ${route.stack}${route.screen ? ` -> ${route.screen}` : ''}`);
    } catch (error) {
      console.error('Navigation error:', error);
    } finally {
      // Reset flag after navigation
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 500);
    }
  }, [navigation]);

  // Trigger navigation programmatically (now executes immediately)
  const triggerNavigation = useCallback((route: NavigationRoute) => {
    executeNavigation(route);
  }, [executeNavigation]);

  // Handle post-authentication navigation with state machine validation
  const handleAuthComplete = useCallback((
    authResponse: LoginMutation['login'] | RegisterMutation['register'],
    rememberMe?: boolean,
    skipModalCheck = false
  ) => {
    if (!authResponse?.user) return;

    const authUser = authResponse.user;
    
    // Save user navigation state
    if (authUser.id) {
      setUserNavigationState(authUser.id, {
        lastLoginTimestamp: Date.now(),
        rememberMeChoice: rememberMe,
      });
    }

    // For registration, don't navigate immediately - let verification flow handle it
    if ('register' in authResponse) {
      // Validate state machine allows transition to verification state
      if (!canTransitionTo(NavigationState.NEEDS_VERIFICATION)) {
        console.warn('[NavigationFlow] Cannot transition to verification state after registration');
        return;
      }
      return;
    }

    // Skip navigation if remember me modal needs to be shown and we're not skipping
    if (!skipModalCheck && rememberMe === undefined) {
      return;
    }

    // Validate state machine before navigation
    const targetState = authUser.emailVerified 
      ? (authUser.onBoarded ? NavigationState.AUTHENTICATED : NavigationState.NEEDS_ONBOARDING)
      : NavigationState.NEEDS_VERIFICATION;

    if (!canTransitionTo(targetState)) {
      console.warn(`[NavigationFlow] Invalid transition attempt to ${targetState}`);
      console.log('[NavigationFlow] Current state machine info:', getStateMachineInfo());
      return;
    }

    // Get target route and trigger navigation
    const route = getNavigationRoute(authUser);
    triggerNavigation(route);
  }, [getNavigationRoute, triggerNavigation, setUserNavigationState, canTransitionTo, getStateMachineInfo]);

  // Handle onboarding step progression
  const handleOnboardingStep = useCallback((step: OnBoardingSteps) => {
    if (!user?.id) return;

    // Update user's onboarding progress
    setUserNavigationState(user.id, {
      onboardingProgress: step,
    });

    // Update global onboarding step
    setOnBoardingStep(step);

    // Determine next route
    let targetRoute: NavigationRoute;
    
    switch (step) {
      case OnBoardingSteps.createShoppingList:
        targetRoute = { 
          stack: 'OnBoardingStack', 
          screen: 'CreateShoppingList', 
          preventGoBack: true 
        };
        break;
      case OnBoardingSteps.selectPantryItems:
        targetRoute = { 
          stack: 'OnBoardingStack', 
          screen: 'SelectPantryItems', 
          preventGoBack: true 
        };
        break;
      case OnBoardingSteps.profilePictureUpload:
        targetRoute = { 
          stack: 'OnBoardingStack', 
          screen: 'ProfilePictureUpload', 
          preventGoBack: true 
        };
        break;
      case OnBoardingSteps.inviteMembers:
        targetRoute = { 
          stack: 'OnBoardingStack', 
          screen: 'InviteMembers', 
          preventGoBack: true 
        };
        break;
      case OnBoardingSteps.complete:
        targetRoute = { 
          stack: 'OnBoardingStack', 
          screen: 'OnboardingComplete', 
          preventGoBack: true 
        };
        break;
      default:
        // If step is unknown, go to HomeStack (user might be completing onboarding)
        targetRoute = { stack: 'HomeStack' };
    }

    triggerNavigation(targetRoute);
  }, [user, setUserNavigationState, setOnBoardingStep, triggerNavigation]);

  // Navigate to home (used after modals complete)
  const navigateToHome = useCallback(() => {
    if (!user) return;
    
    const route = getNavigationRoute(user);
    triggerNavigation(route);
  }, [user, getNavigationRoute, triggerNavigation]);

  // Navigate to verification
  const navigateToVerification = useCallback((email?: string, password?: string) => {
    const route: NavigationRoute = { 
      stack: 'AuthStack', 
      screen: 'CodeVerification',
      params: email && password ? { email, password } : undefined 
    };
    triggerNavigation(route);
  }, [triggerNavigation]);

  // React Navigation event listeners for enhanced navigation tracking
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('Screen focused');
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      console.log('Screen blurred');
    });

    const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', (e) => {
      // Can be used to prevent navigation if needed
      console.log('Before remove event:', e.data.action);
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
      unsubscribeBeforeRemove();
    };
  }, [navigation]);

  return {
    getNavigationRoute,
    handleAuthComplete,
    handleOnboardingStep,
    navigateToHome,
    navigateToVerification,
    executeNavigation,
    triggerNavigation,
    isNavigating: isNavigatingRef.current,
  };
};