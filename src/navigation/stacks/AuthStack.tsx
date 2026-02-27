import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { LandingAuthScreen } from '#screens/auth/LandingAuthScreen';
import { LoginScreen } from '#screens/auth/LoginScreen';
import { SignUpScreen } from '#screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '#screens/auth/ForgotPasswordScreen';
import { CodeVerificationScreen } from '#screens/auth/CodeVerificationScreen';

export const AuthStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
  }),
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
