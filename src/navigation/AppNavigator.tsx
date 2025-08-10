import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useStore} from '../store';

import AuthStack from './AuthStack';
import HomeTab from './TabNavigator';
import OnBoardingStack from './OnBoardingStack';
import BarcodeStack from './BarcodeStack';
import {NotFoundScreen} from '../screens/NotFoundScreen';
import type {RootStackParamList} from './types';
import {OnBoardingSteps} from '#/store/slices/preferencesSlice';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const {isHydrated, user, onBoardingStep} = useStore();
  if (!isHydrated) {
    // still loading your persisted zustand store
    return null;
  }
  // only gate on user existence & verification here — rememberMe is handled _inside_ AuthStack.
  const initialRoute: keyof RootStackParamList =
    !user || !user.emailVerified
      ? 'AuthStack'
      : onBoardingStep !== OnBoardingSteps.complete
        ? 'OnBoardingStack'
        : 'HomeStack';
  return (
    <NavigationContainer>
      <Stack.Navigator
        key={initialRoute} // remount & clear history on change
        initialRouteName={initialRoute} // must be one of 'Auth' | 'Home' | 'OnBoarding' | 'NotFound'
        screenOptions={{headerShown: false}}>
        {/* your two “flow” entry-points */}
        <Stack.Screen name="AuthStack" component={AuthStack} />
        <Stack.Screen name="OnBoardingStack" component={OnBoardingStack} />
        <Stack.Screen name="HomeStack" component={HomeTab} />
        <Stack.Screen name="BarcodeStack" component={BarcodeStack} />
        {/* always have a catch-all for NotFound */}
        {/* always have a catch-all */}
        <Stack.Screen name="NotFound" component={NotFoundScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
