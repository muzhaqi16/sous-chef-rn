import { createNativeStackScreen } from '@react-navigation/native-stack';
import { LandingAuthScreen } from './LandingAuthScreen';
import { LoginScreen } from './LoginScreen';
import { SignUpScreen } from './SignUpScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';

/**
 * The signed-out stack's screens, spread into `AuthStack`. Must stay a literal
 * — react-navigation infers per-screen param types only from one. Verification
 * and reset are absent by design: `RootNavigator` registers them so their deep
 * links resolve with no session.
 */
export const authScreens = {
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
};
