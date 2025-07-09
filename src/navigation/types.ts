import type {
  CompositeScreenProps,
  NavigatorScreenParams,
  CompositeNavigationProp,
  RouteProp,
} from '@react-navigation/native';
import {User} from '../api/graphql/generated';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {
  StackScreenProps,
  StackNavigationProp,
} from '@react-navigation/stack';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';

export type RootStackParamList = {
  Home: NavigatorScreenParams<HomeTabParamList>;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  OnBoarding: NavigatorScreenParams<OnBoardingStackParamList>;
  NotFound: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  StackScreenProps<RootStackParamList, T>;

export type HomeTabParamList = {
  Main: undefined;
  ShoppingList: undefined;
  Recipes: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  RememberLoginInfo: {
    email: string;
    password: string;
    accessToken: string;
    refreshToken: string;
    user: User;
  };
  ResetPassword: {token: string};
  ChangePassword: undefined;
  ConfirmEmail: {email: string};
  CodeVerification: {email: string; code: string};
};

export type OnBoardingStackParamList = {
  CreateShoppingList: undefined;
  SelectPantryItems: undefined;
  AddRecipes: undefined;
  AddFriends: undefined;
  AddProfilePicture: undefined;
  OnBoardingCompleted: undefined;
};

export type HomeTabScreenProps<T extends keyof HomeTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<HomeTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  CompositeScreenProps<
    StackScreenProps<AuthStackParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

export type LoginNavProp = StackNavigationProp<AuthStackParamList, 'Login'>;
export type RootNavProp = StackNavigationProp<RootStackParamList>;

export type OnBoardingNavProp = StackNavigationProp<
  OnBoardingStackParamList,
  'CreateShoppingList'
>;

export type CreateShoppingListNavProp = CompositeNavigationProp<
  OnBoardingNavProp,
  RootNavProp
>;

export type SignUpNavProp = StackNavigationProp<AuthStackParamList, 'SignUp'>;
export type RememberNavProp = NativeStackNavigationProp<
  AuthStackParamList,
  'RememberLoginInfo'
>;
type RememberRouteProp = RouteProp<AuthStackParamList, 'RememberLoginInfo'>;

export type RememberLoginInfoProps = {
  navigation: RememberNavProp;
  route: RememberRouteProp;
};

export type LoginScreenProps = AuthStackScreenProps<'Login'>;
export type LoginScreenNavigationProps = LoginScreenProps['navigation'];
export type SignUpScreenProps = AuthStackScreenProps<'SignUp'>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
