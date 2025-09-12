import React, {useRef, useEffect, useState} from 'react';
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
import {
  ProfilePhotoUploadScreen,
  NotFoundScreen,
  SplashScreen,
  ImageCropScreen,
} from '#screens';
import type {RootStackParamList} from './types';
import {linkingConfig} from './linking';
import {useTokenRefresh, useNavigationState, useAutoLogin} from '#hooks';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Helper function to get the root stack name from navigation state
const getRootStackName = (state: any): string | undefined => {
  if (!state) return undefined;

  // Navigate to the root of the state
  let currentState = state;
  while (currentState.routes && currentState.index !== undefined) {
    const route = currentState.routes[currentState.index];
    if (!route.state) {
      // This is the deepest route
      return state.routes[state.index].name;
    }
    currentState = route.state;
  }

  return state.routes?.[state.index]?.name;
};

export default function AppNavigator() {
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);
  const {user} = useStore();
  const {targetRoute, isReady, saveUserProgress, hasStoredCredentials} =
    useNavigationState();

  const {isAutoLoginAttempting, autoLoginCompleted} = useAutoLogin();

  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [minSplashComplete, setMinSplashComplete] = useState(false);
  const [hasNavigatedToTarget, setHasNavigatedToTarget] = useState(false);

  // Set up navigation service
  useEffect(() => {
    if (navigationRef.current && isNavigationReady) {
      NavigationService.setNavigator(navigationRef.current);
      NavigationService.setIsReady(true);
    }
  }, [isNavigationReady]);

  // Minimum splash screen duration (1.5 seconds)
  useEffect(() => {
    const timer = setTimeout(() => setMinSplashComplete(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Token refresh
  useTokenRefresh();

  // Track navigation state changes for authenticated users
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

  // Navigate when target route changes and navigation is ready
  useEffect(() => {
    if (!isNavigationReady || !navigationRef.current || !targetRoute) return;

    // Get the current root stack name
    const state = navigationRef.current.getState();
    const currentRootStack = getRootStackName(state);

    // Only navigate if we're not already on the target stack
    if (currentRootStack !== targetRoute && !hasNavigatedToTarget) {
      console.log(`Navigating from ${currentRootStack} to ${targetRoute}`);

      // Use setTimeout to ensure state updates have propagated
      setTimeout(() => {
        navigationRef.current?.reset({
          index: 0,
          routes: [{name: targetRoute as keyof RootStackParamList}],
        });
        setHasNavigatedToTarget(true);
      }, 0);
    }
  }, [targetRoute, isNavigationReady, hasNavigatedToTarget]);

  // Reset navigation flag when target route changes
  useEffect(() => {
    setHasNavigatedToTarget(false);
  }, [targetRoute]);

  // Simplified splash screen logic
  const showSplash =
    !isReady ||
    !minSplashComplete ||
    isAutoLoginAttempting ||
    (!user && !autoLoginCompleted);

  if (showSplash) {
    return <SplashScreen />;
  }

  // Use a safe initial route - default to AuthStack if targetRoute is null
  const initialRouteName = (targetRoute ||
    'AuthStack') as keyof RootStackParamList;

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linkingConfig}
      onReady={() => setIsNavigationReady(true)}
      onStateChange={state => {
        // Save navigation state for authenticated users only
        if (state && user) {
          try {
            storage.set('navigation_state', JSON.stringify(state));
          } catch (error) {
            console.warn('Failed to save navigation state:', error);
          }
        }
      }}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
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
        <Stack.Screen name="NotificationStack" component={NotificationStack} />
        <Stack.Screen
          name="ProfilePhotoUpload"
          component={ProfilePhotoUploadScreen}
        />
        <Stack.Screen name="ImageCrop" component={ImageCropScreen} />
        <Stack.Screen name="NotFound" component={NotFoundScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
