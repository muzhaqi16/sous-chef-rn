import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { LandingAuthScreen } from '#screens/auth/LandingAuthScreen';
import { LoginScreen } from '#screens/auth/LoginScreen';
import { SignUpScreen } from '#screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '#screens/auth/ForgotPasswordScreen';
import { CodeVerificationScreen } from '#screens/auth/CodeVerificationScreen';

export const AuthStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    animation: 'slide_from_right',
  },
  screens: {
    LandingAuth: {
      screen: LandingAuthScreen,
      linking: 'welcome',
    },
    Login: {
      screen: LoginScreen,
      linking: 'login',
    },
    SignUp: {
      screen: SignUpScreen,
      linking: 'signup',
    },
    ForgotPassword: {
      screen: ForgotPasswordScreen,
      linking: 'forgot-password',
    },
    CodeVerification: {
      screen: CodeVerificationScreen,
      linking: 'auth/verify/:email?',
    },
  },
});
