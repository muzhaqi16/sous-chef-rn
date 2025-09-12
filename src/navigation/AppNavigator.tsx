import React, {useRef, useEffect, useState, useCallback} from 'react';
import {
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import {storage} from '#/storage/mmkv';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useStore} from '#store';
import NavigationService from '../services/NavigationService';
import {
  AuthStack,
  HomeManagementStack,
  HomeTab,
  OnBoardingStack,
  BarcodeStack,
  NotificationStack,
} from './index';
import {ProfilePhotoUploadScreen, NotFoundScreen, SplashScreen} from '#screens';
import {ImageCropScreen} from '../screens/profile/ImageCropScreen';
import {NavigationDebugger} from '../components/dev/NavigationDebugger';
import type {RootStackParamList} from './types';
import {linkingConfig} from './linking';
import {
  useTokenRefresh,
  useNavigationState,
  useAutoLogin,
  useNavigationGuards,
} from '#hooks';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);
  const {user} = useStore();
  const {
    navigationState,
    isReady,
    saveUserProgress,
    hasStoredCredentials,
    getStateMachineInfo,
  } = useNavigationState();

  // Auto-login hook for automatic authentication
  const {isAutoLoginAttempting, autoLoginCompleted} = useAutoLogin();

  // Simple route determination without React Navigation hooks
  const getInitialRoute = useCallback(
    (
      currentUser: any,
      hasStoredCredentials?: boolean | null,
    ): keyof RootStackParamList => {
      // No user - go to auth
      if (!currentUser) {
        return 'AuthStack';
      }

      // User exists - check verification status
      if (!currentUser.emailVerified) {
        return 'AuthStack';
      }

      // User verified - check onboarding status
      if (!currentUser.onBoarded) {
        return 'OnBoardingStack';
      }

      // Fully onboarded user
      return 'HomeStack';
    },
    [],
  );

  // Navigation state persistence
  const [initialNavigationState, setInitialNavigationState] = useState<any>();
  const [isStateRestored, setIsStateRestored] = useState(false);

  // Minimum splash screen duration to prevent rapid transitions
  const [minSplashComplete, setMinSplashComplete] = useState(false);

  // Restore navigation state on app start
  useEffect(() => {
    const restoreNavigationState = async () => {
      try {
        const savedStateString = storage.getString('navigation_state');
        if (savedStateString && user) {
          // Only restore state if user is already authenticated
          const savedState = JSON.parse(savedStateString);
          setInitialNavigationState(savedState);
        }
      } catch (error) {
        console.warn('Failed to restore navigation state:', error);
      } finally {
        setIsStateRestored(true);
      }
    };

    if (isReady) {
      restoreNavigationState();
    }
  }, [isReady, user]);

  // Set up navigation service
  useEffect(() => {
    if (navigationRef.current) {
      NavigationService.setNavigator(navigationRef.current);
    }
  }, []);

  // Minimum splash screen duration (1.5 seconds)
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinSplashComplete(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Call token refresh at the app navigator level
  useTokenRefresh();

  // Track navigation state changes for user
  useEffect(() => {
    if (!navigationRef.current || !user?.id) return;

    const unsubscribe = navigationRef.current.addListener('state', () => {
      const currentRoute = navigationRef.current?.getCurrentRoute();
      if (currentRoute) {
        saveUserProgress({
          lastRoute: currentRoute.name,
          lastLoginTimestamp: Date.now(),
        });
      }
    });

    return unsubscribe;
  }, [user?.id, saveUserProgress]);

  // Save navigation state on changes
  const onNavigationStateChange = (state: any) => {
    if (state && user) {
      // Only save navigation state for authenticated users
      try {
        storage.set('navigation_state', JSON.stringify(state));
      } catch (error) {
        console.warn('Failed to save navigation state:', error);
      }
    }
  };

  // Show splash screen until everything is ready AND minimum duration has passed
  const shouldShowSplash =
    !isReady || // This already includes credential check completion
    !isStateRestored ||
    isAutoLoginAttempting ||
    !minSplashComplete ||
    (!autoLoginCompleted && !user); // Wait for auto-login to complete if no user

  if (shouldShowSplash) {
    return <SplashScreen />;
  }

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        initialState={initialNavigationState}
        onStateChange={onNavigationStateChange}
        linking={linkingConfig}
        onReady={() => {
          NavigationService.setIsReady(true);
        }}>
        <Stack.Navigator
          initialRouteName={getInitialRoute(user, hasStoredCredentials)}
          screenOptions={{headerShown: false}}>
          <Stack.Screen name="AuthStack">
            {() => <AuthStack hasStoredCredentials={hasStoredCredentials} />}
          </Stack.Screen>
          <Stack.Screen name="OnBoardingStack" component={OnBoardingStack} />
          <Stack.Screen name="HomeStack" component={HomeTab} />
          <Stack.Screen
            name="HomeManagementStack"
            component={HomeManagementStack}
          />
          <Stack.Screen name="BarcodeStack" component={BarcodeStack} />
          <Stack.Screen
            name="NotificationStack"
            component={NotificationStack}
          />
          <Stack.Screen
            name="ProfilePhotoUpload"
            component={ProfilePhotoUploadScreen}
          />
          <Stack.Screen name="ImageCrop" component={ImageCropScreen} />
          <Stack.Screen name="NotFound" component={NotFoundScreen} />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Development Navigation Debugger - rendered outside NavigationContainer */}
      {/* {__DEV__ && <NavigationDebugger visible={false} />} */}
    </>
  );
}
