import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  LandingAuthScreen,
  LoginScreen,
  SignUpScreen,
  ForgotPasswordScreen,
  CodeVerificationScreen,
} from '#screens/auth';

export type AuthStackParamList = {
  LandingAuth: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  CodeVerification: {email?: string; password?: string};
};

export type AuthStackNavigationProp = {
  navigate: (screen: keyof AuthStackParamList, params?: any) => void;
  goBack: () => void;
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = {
  navigation: AuthStackNavigationProp;
  route: {key: string; name: T; params: AuthStackParamList[T]};
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
    }}>
    <Stack.Screen name="LandingAuth" component={LandingAuthScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen name="CodeVerification" component={CodeVerificationScreen} />
  </Stack.Navigator>
);
