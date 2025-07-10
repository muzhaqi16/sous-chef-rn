import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useStore} from '../store';
import {type AuthStackParamList} from './types';
import {
  LoginScreen,
  SignUpScreen,
  RememberLoginInfoScreen,
  ForgotPasswordScreen,
  CodeVerificationScreen,
} from '../screens/Auth';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthStack = () => {
  const {isHydrated, rememberMe, user} = useStore();
  // Wait for the store to be hydrated before rendering the stack
  if (!isHydrated) {
    return null; // or a loading spinner
  }

  // pick initialRoute synchronously
  const initialRoute: keyof AuthStackParamList = !user
    ? 'Login'
    : !user.emailVerified
      ? 'CodeVerification'
      : rememberMe === undefined // only here when we haven’t asked yet
        ? 'RememberLoginInfo'
        : 'Login'; // or wherever makes sense after “no thanks”

  return (
    <Stack.Navigator
      key={initialRoute}
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,

        // pick one of the native presets:
        // animation: 'fade_from_bottom', // fade in from bottom
        // animation: 'fade',               // simple cross-fade
        // animation: 'slide_from_right',   // slide in from the right
        // animation: 'slide_from_left',    // slide in from the left
        // animation: 'slide_from_bottom',  // slide in from the bottom
        // animation: 'flip',               // iOS only, with presentation: 'modal'
        // animation: 'none',               // no animation at all

        // if you ever do a replace(), you can pick its animation too
        animationTypeForReplace: 'push', // or 'pop'

        // you can also tweak gesture directions if you like:
        gestureEnabled: true,
        gestureDirection: 'vertical', // vertical swipe to dismiss
      }}>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{headerShown: false, animation: 'slide_from_left'}}
      />
      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{headerShown: false, animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{headerShown: false, animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="RememberLoginInfo"
        component={RememberLoginInfoScreen}
      />
      <Stack.Screen
        name="CodeVerification"
        component={CodeVerificationScreen}
        options={{animation: 'slide_from_bottom'}}
      />
    </Stack.Navigator>
  );
};

export default AuthStack;
