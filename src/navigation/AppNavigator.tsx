import React, {useRef, useEffect, useState} from 'react';
import {
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
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
import {useTokenRefresh, useNavigationState, useAutoLogin} from '#hooks';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);
  const {user} = useStore();
  const {navigationState, targetRoute, isReady, saveUserProgress, hasStoredCredentials} =
    useNavigationState();
  
  // Auto-login hook for automatic authentication
  const {isAutoLoginAttempting, autoLoginCompleted} = useAutoLogin();
  
  // Minimum splash screen duration to prevent rapid transitions
  const [minSplashComplete, setMinSplashComplete] = useState(false);
  
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

  // Show splash screen until everything is ready AND minimum duration has passed
  const shouldShowSplash = 
    !isReady || // This already includes credential check completion
    isAutoLoginAttempting || 
    !minSplashComplete ||
    (!autoLoginCompleted && !user); // Wait for auto-login to complete if no user


  if (shouldShowSplash) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        NavigationService.setIsReady(true);
      }}>
      <Stack.Navigator
        key={`${targetRoute}-${user?.id || 'anonymous'}`} // Key by route and user
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
        <Stack.Screen
          name="ImageCrop"
          component={ImageCropScreen}
        />
        <Stack.Screen name="NotFound" component={NotFoundScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
