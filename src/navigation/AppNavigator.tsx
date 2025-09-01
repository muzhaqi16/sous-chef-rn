import React, {useRef, useEffect} from 'react';
import {
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useStore} from '../store';
import {useNavigationState} from '../hooks/navigation/useNavigationState';
import NavigationService from '../services/NavigationService';
import AuthStack from './AuthStack';
import HomeTab from './TabNavigator';
import OnBoardingStack from './OnBoardingStack';
import BarcodeStack from './BarcodeStack';
import NotificationStack from './NotificationStack';
import {NotFoundScreen} from '../screens/NotFoundScreen';
import type {RootStackParamList} from './types';
import {HomeManagementStack} from './HomeStack';
import {useTokenRefresh} from '#/hooks/auth/useTokenRefresh';
import SplashScreen from '../screens/SplashScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);
  const {user} = useStore();
  const {navigationState, targetRoute, isReady, saveUserProgress} =
    useNavigationState();
  console.log(
    'Navigation State:',
    navigationState,
    'Target Route:',
    targetRoute,
  );
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
        <Stack.Screen name="NotFound" component={NotFoundScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
