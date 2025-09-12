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
import {ProfilePhotoUploadScreen, NotFoundScreen, SplashScreen} from '#screens';
import {ImageCropScreen} from '../screens/profile/ImageCropScreen';
import type {RootStackParamList} from './types';
import {linkingConfig} from './linking';
import {useTokenRefresh, useNavigationState, useAutoLogin} from '#hooks';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);
  const {user} = useStore();
  const {targetRoute, isReady, saveUserProgress, hasStoredCredentials} =
    useNavigationState();

  const {isAutoLoginAttempting, autoLoginCompleted} = useAutoLogin();

  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [minSplashComplete, setMinSplashComplete] = useState(false);

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
    if (!isNavigationReady || !navigationRef.current) return;

    const currentRoute = navigationRef.current.getCurrentRoute();

    // Only navigate if we're not already on the target route
    if (currentRoute?.name !== targetRoute) {
      navigationRef.current.reset({
        index: 0,
        routes: [{name: targetRoute as keyof RootStackParamList}],
      });
    }
  }, [targetRoute, isNavigationReady]);

  // Simplified splash screen logic
  const showSplash =
    !isReady ||
    !minSplashComplete ||
    isAutoLoginAttempting ||
    (!user && !autoLoginCompleted);

  if (showSplash) {
    return <SplashScreen />;
  }

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
        initialRouteName={targetRoute as keyof RootStackParamList}
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
