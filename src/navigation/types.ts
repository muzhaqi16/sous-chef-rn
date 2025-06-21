import type {
  CompositeScreenProps,
  NavigatorScreenParams,
  CompositeNavigationProp,
} from '@react-navigation/native';
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
  ShoppingList: undefined;
  Recipes: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: {token: string};
  ChangePassword: undefined;
  ConfirmEmail: {email: string};
  ConfirmCode: {email: string; code: string};
};

export type OnBoardingStackParamList = {
  CreateShoppingList: undefined;
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

export type AuthNavProp = StackNavigationProp<AuthStackParamList, 'Login'>;
export type RootNavProp = StackNavigationProp<RootStackParamList>;

export type CreateShoppingListNavProp = CompositeNavigationProp<
  AuthNavProp,
  RootNavProp
>;

export type LoginNavProp = CompositeNavigationProp<AuthNavProp, RootNavProp>;

export type LoginScreenProps = AuthStackScreenProps<'Login'>;
export type LoginScreenNavigationProps = LoginScreenProps['navigation'];
export type SignUpScreenProps = AuthStackScreenProps<'SignUp'>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
