import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useStore} from '../store';
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

  const getAuthStackInitialRoute = () => {
    if (!user) {
      if (hasStoredCredentials === true) {
        return 'Login';
      } else if (hasStoredCredentials === false) {
        return rememberMe === undefined ? 'LandingAuth' : 'Login';
      }
      return 'Login';
    }
    if (!user.emailVerified) {
      return 'CodeVerification';
    }
    return 'Login';
  };

  const authStackInitialRoute = getAuthStackInitialRoute();
  const shouldRender = isHydrated && (user || hasStoredCredentials !== null);

  if (!shouldRender) {
    return null;
  }

  const initialRoute: keyof AuthStackParamList =
    authStackInitialRoute as keyof AuthStackParamList;

  return (
    <Stack.Navigator
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
      <Stack.Screen name="Login" options={{animation: 'slide_from_left'}}>
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
