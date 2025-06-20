import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type {StackScreenProps} from '@react-navigation/stack';
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

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
