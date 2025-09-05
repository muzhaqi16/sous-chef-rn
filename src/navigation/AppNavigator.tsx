import React, {useRef, useEffect} from 'react';
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
import {useTokenRefresh, useNavigationState} from '#hooks';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);
  const {user} = useStore();
  const {navigationState, targetRoute, isReady, saveUserProgress} =
    useNavigationState();
  // Set up navigation service
  useEffect(() => {
    if (navigationRef.current) {
      NavigationService.setNavigator(navigationRef.current);
    }
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

  // If not hydrated, show splash screen
  if (!isReady) {
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
        <Stack.Screen name="AuthStack" component={AuthStack} />
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
