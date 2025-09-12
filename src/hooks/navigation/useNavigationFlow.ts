import {useCallback} from 'react';
import {useSafeNavigation} from '../useSafeNavigation';
import {CommonActions, StackActions} from '@react-navigation/native';

export const useNavigationFlow = () => {
  const {navigation} = useSafeNavigation();

  // Core navigation method - reset to a specific stack
  const navigateToStack = useCallback(
    (stack: string, screen?: string, params?: any) => {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: stack,
            params: screen ? {screen, ...params} : params,
          },
        ],
      });
    },
    [navigation],
  );

  // Navigate within current stack
  const navigateWithinStack = useCallback(
    (screen: string, params?: any) => {
      navigation.navigate(screen, params);
    },
    [navigation],
  );

  // Go back if possible
  const goBack = useCallback(() => {
    console.log('Attempting to go back');
    if (navigation.canGoBack()) {
      console.log('Going back');
      navigation.goBack();
    }
  }, [navigation]);

  // Stack-specific navigation shortcuts
  const navigateToAuth = useCallback(
    (screen?: string, params?: any) => {
      navigateToStack('AuthStack', screen, params);
    },
    [navigateToStack],
  );

  const navigateToOnboarding = useCallback(
    (screen?: string, params?: any) => {
      navigateToStack('OnBoardingStack', screen, params);
    },
    [navigateToStack],
  );

  const navigateToHome = useCallback(
    (params?: any) => {
      navigateToStack('HomeStack', undefined, params);
    },
    [navigateToStack],
  );

  // Navigate to specific auth screens
  const navigateToLogin = useCallback(
    (params?: any) => {
      navigateToAuth('Login', params);
    },
    [navigateToAuth],
  );

  const navigateToSignUp = useCallback(
    (params?: any) => {
      navigateToAuth('SignUp', params);
    },
    [navigateToAuth],
  );

  const navigateToVerification = useCallback(
    (email?: string, password?: string) => {
      navigateToAuth(
        'CodeVerification',
        email && password ? {email, password} : undefined,
      );
    },
    [navigateToAuth],
  );

  const navigateToForgotPassword = useCallback(
    (email?: string) => {
      navigateToAuth('ForgotPassword', email ? {email} : undefined);
    },
    [navigateToAuth],
  );

  // Common navigation patterns using dispatch
  const replaceCurrentScreen = useCallback(
    (screen: string, params?: any) => {
      navigation.dispatch(StackActions.replace(screen, params));
    },
    [navigation],
  );

  const pushToStack = useCallback(
    (screen: string, params?: any) => {
      navigation.dispatch(StackActions.push(screen, params));
    },
    [navigation],
  );

  // Navigate to nested stacks
  const navigateToNestedStack = useCallback(
    (
      parentStack: string,
      childStack: string,
      screen?: string,
      params?: any,
    ) => {
      navigation.dispatch(
        CommonActions.navigate({
          name: parentStack,
          params: {
            screen: childStack,
            params: screen ? {screen, params} : params,
          },
        }),
      );
    },
    [navigation],
  );

  // Navigate to specific feature stacks
  const navigateToPantry = useCallback(
    (screen?: string, params?: any) => {
      if (screen) {
        navigateToNestedStack('HomeStack', 'Main', screen, params);
      } else {
        navigation.dispatch(
          CommonActions.navigate({
            name: 'HomeStack',
            params: {screen: 'Main'},
          }),
        );
      }
    },
    [navigation, navigateToNestedStack],
  );

  const navigateToShoppingList = useCallback(
    (screen?: string, params?: any) => {
      if (screen) {
        navigateToNestedStack('HomeStack', 'ShoppingList', screen, params);
      } else {
        navigation.dispatch(
          CommonActions.navigate({
            name: 'HomeStack',
            params: {screen: 'ShoppingList'},
          }),
        );
      }
    },
    [navigation, navigateToNestedStack],
  );

  const navigateToProfile = useCallback(
    (screen?: string, params?: any) => {
      if (screen) {
        navigateToNestedStack('HomeStack', 'Profile', screen, params);
      } else {
        navigation.dispatch(
          CommonActions.navigate({
            name: 'HomeStack',
            params: {screen: 'Profile'},
          }),
        );
      }
    },
    [navigation, navigateToNestedStack],
  );

  const navigateToHomeManagement = useCallback(
    (homeId?: string) => {
      navigateToStack(
        'HomeManagementStack',
        'HomeManagement',
        homeId ? {selectedHomeId: homeId} : undefined,
      );
    },
    [navigateToStack],
  );

  const navigateToBarcode = useCallback(
    (source?: 'pantry' | 'shoppingList', listId?: string) => {
      navigateToStack(
        'BarcodeStack',
        'BarcodeScanner',
        source ? {source, [`${source}Id`]: listId} : undefined,
      );
    },
    [navigateToStack],
  );

  const navigateToNotifications = useCallback(() => {
    navigateToStack('NotificationStack', 'NotificationList');
  }, [navigateToStack]);

  // Pop to top of current stack
  const popToTop = useCallback(() => {
    navigation.dispatch(StackActions.popToTop());
  }, [navigation]);

  // Check if can go back
  const canGoBack = useCallback(() => {
    return navigation.canGoBack();
  }, [navigation]);

  // Get current route
  const getCurrentRoute = useCallback(() => {
    const state = navigation.getState();
    if (!state) return null;

    const route = state.routes[state.index];
    return route;
  }, [navigation]);

  // Get current route name
  const getCurrentRouteName = useCallback(() => {
    const route = getCurrentRoute();
    return route?.name;
  }, [getCurrentRoute]);

  return {
    // Core navigation
    navigateToStack,
    navigateWithinStack,
    goBack,
    popToTop,
    canGoBack,
    getCurrentRoute,
    getCurrentRouteName,

    // Stack navigation
    navigateToAuth,
    navigateToOnboarding,
    navigateToHome,

    // Auth screens
    navigateToLogin,
    navigateToSignUp,
    navigateToVerification,
    navigateToForgotPassword,

    // Feature stacks
    navigateToPantry,
    navigateToShoppingList,
    navigateToProfile,
    navigateToHomeManagement,
    navigateToBarcode,
    navigateToNotifications,

    // Navigation patterns
    replaceCurrentScreen,
    pushToStack,
    navigateToNestedStack,
  };
};
