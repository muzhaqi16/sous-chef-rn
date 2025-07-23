import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useStore} from '../store';

import AuthStack from './AuthStack';
import HomeTab from './TabNavigator';
import OnBoardingStack from './OnBoardingStack';
import {NotFoundScreen} from '../screens/NotFoundScreen';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const {isHydrated, user, onBoardingCompleted} = useStore();

  if (!isHydrated) {
    // still loading your persisted zustand store
    return null;
  }
  // only gate on user existence & verification here — rememberMe is handled _inside_ AuthStack.
  const initialRoute: keyof RootStackParamList =
    !user || !user.emailVerified
      ? 'Auth'
      : !onBoardingCompleted
        ? 'OnBoarding'
        : 'Home';
  return (
    <NavigationContainer>
      <Stack.Navigator
        key={initialRoute} // remount & clear history on change
        initialRouteName={initialRoute} // must be one of 'Auth' | 'Home' | 'OnBoarding' | 'NotFound'
        screenOptions={{headerShown: false}}>
        {/* your two “flow” entry-points */}
        <Stack.Screen name="Auth" component={AuthStack} />
        <Stack.Screen name="OnBoarding" component={OnBoardingStack} />
        <Stack.Screen name="Home" component={HomeTab} />

        {/* always have a catch-all */}
        <Stack.Screen name="NotFound" component={NotFoundScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
