import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useStore} from '../store';
import AuthStack from './AuthStack';
import HomeTab from './TabNavigator';
import OnBoardingStack from './OnBoardingStack';
import BarcodeStack from './BarcodeStack';
import NotificationStack from './NotificationStack'; // Add this
import {NotFoundScreen} from '../screens/NotFoundScreen';
import type {RootStackParamList} from './types';
import {HomeManagementStack} from './HomeStack';
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const {isHydrated, user} = useStore();

  if (!isHydrated) {
    return null;
  }

  const initialRoute: keyof RootStackParamList =
    !user || !user.emailVerified
      ? 'AuthStack'
      : !user.onBoarded
        ? 'OnBoardingStack'
        : 'HomeStack';

  return (
    <NavigationContainer>
      <Stack.Navigator
        key={initialRoute}
        initialRouteName={initialRoute}
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
