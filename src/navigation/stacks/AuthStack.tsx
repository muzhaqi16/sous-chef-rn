import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { LandingAuthScreen } from '#screens/auth/LandingAuthScreen';
import { LoginScreen } from '#screens/auth/LoginScreen';
import { SignUpScreen } from '#screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '#screens/auth/ForgotPasswordScreen';
import { CodeVerificationScreen } from '#screens/auth/CodeVerificationScreen';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

export const AuthStack = createNativeStackNavigator({
  // Top safe-area inset, applied per screen (it's no longer global — see
  // TopInsetLayout). No immersive screen here, so inset every screen.
  screenLayout: topInsetScreenLayout,
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
    inactiveBehavior: 'none',
  }),
  screens: {
    LandingAuth: createNativeStackScreen({
      screen: LandingAuthScreen,
      linking: 'welcome',
    }),
    Login: createNativeStackScreen({
      screen: LoginScreen,
      linking: 'login',
    }),
    SignUp: createNativeStackScreen({
      screen: SignUpScreen,
      linking: 'signup',
    }),
    ForgotPassword: createNativeStackScreen({
      screen: ForgotPasswordScreen,
      linking: 'forgot-password',
    }),
    CodeVerification: createNativeStackScreen({
      screen: CodeVerificationScreen,
      linking: 'auth/verify/:email?',
    }),
  },
});

export type AuthStackParams = StaticParamList<typeof AuthStack>;
