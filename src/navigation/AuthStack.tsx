import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useStore} from '../store';
import {useNavigationState} from '../hooks/navigation/useNavigationState';
import {type AuthStackParamList} from './types';
import {
  LoginScreen,
  SignUpScreen,
  ForgotPasswordScreen,
  CodeVerificationScreen,
  LandingAuthScreen,
} from '../screens/auth';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthStack = () => {
  const {isHydrated, user} = useStore();
  const {authStackInitialRoute} = useNavigationState();

  // Wait for the store to be hydrated before rendering the stack
  if (!isHydrated) {
    return null; // or a loading spinner
  }

  const initialRoute: keyof AuthStackParamList =
    authStackInitialRoute as keyof AuthStackParamList;

  console.log('AuthStack initialRoute:', initialRoute);

  return (
    <Stack.Navigator
      key={`auth-${user?.id || 'anonymous'}-${initialRoute}`}
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}>
      {/* Unauthenticated screens */}
      {!user && (
        <>
          <Stack.Screen
            name="LandingAuth"
            component={LandingAuthScreen}
            options={{animation: 'fade_from_bottom'}}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{animation: 'slide_from_left'}}
          />
          <Stack.Screen
            name="SignUp"
            component={SignUpScreen}
            options={{animation: 'slide_from_right'}}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{animation: 'slide_from_right'}}
          />
        </>
      )}

      {/* Email verification screen (for authenticated but unverified users) */}
      {user && !user.emailVerified && (
        <Stack.Screen
          name="CodeVerification"
          component={CodeVerificationScreen}
          options={{animation: 'slide_from_bottom'}}
        />
      )}
    </Stack.Navigator>
  );
};
