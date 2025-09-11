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

interface AuthStackProps {
  hasStoredCredentials: boolean | null;
}

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthStack = ({hasStoredCredentials}: AuthStackProps) => {
  const {isHydrated, user, rememberMe} = useStore();
  
  // Get the initial route logic without calling the full hook
  const getAuthStackInitialRoute = () => {
    if (!user) {
      if (hasStoredCredentials === true) {
        return 'Login';
      } else if (hasStoredCredentials === false) {
        return rememberMe === undefined ? 'LandingAuth' : 'Login';
      }
      console.warn('AuthStack rendering but credentials still null - defaulting to Login');
      return 'Login';
    }
    if (!user.emailVerified) {
      return 'CodeVerification';
    }
    return 'Login';
  };
  
  const authStackInitialRoute = getAuthStackInitialRoute();

  // Wait for the store to be hydrated AND navigation decision to be made
  const credentialCheckComplete = user || hasStoredCredentials !== null;
  const shouldRender = isHydrated && credentialCheckComplete;
  
  if (!shouldRender) {
    return null; // Navigation decision not ready yet
  }

  const initialRoute: keyof AuthStackParamList =
    authStackInitialRoute as keyof AuthStackParamList;

  return (
    <Stack.Navigator
      key={`auth-${user?.id || 'anonymous'}-${initialRoute}`}
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}>
      {/* Always render all auth screens to avoid initialRouteName issues */}
      <Stack.Screen
        name="LandingAuth"
        component={LandingAuthScreen}
        options={{animation: 'fade_from_bottom'}}
      />
      <Stack.Screen
        name="Login"
        options={{animation: 'slide_from_left'}}>
        {() => <LoginScreen hasStoredCredentials={hasStoredCredentials} />}
      </Stack.Screen>
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
      <Stack.Screen
        name="CodeVerification"
        component={CodeVerificationScreen}
        options={{animation: 'slide_from_bottom'}}
      />
    </Stack.Navigator>
  );
};
