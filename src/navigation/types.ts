import type {
  CompositeScreenProps,
  NavigatorScreenParams,
  RouteProp,
} from '@react-navigation/native';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import type {
  StackScreenProps,
  StackNavigationProp,
} from '@react-navigation/stack';
import type {
  BottomTabScreenProps,
  BottomTabNavigationProp,
} from '@react-navigation/bottom-tabs';
import type {NotificationItem} from '#store/slices/notificationSlice';

// ============================================================================
// PARAMETER LISTS
// ============================================================================

export type RootStackParamList = {
  HomeStack: NavigatorScreenParams<HomeTabParamList>;
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  OnBoardingStack: NavigatorScreenParams<OnBoardingStackParamList>;
  BarcodeStack: NavigatorScreenParams<BarcodeStackParamList>;
  NotificationStack: NavigatorScreenParams<NotificationStackParamList>;
  ShoppingListStack: NavigatorScreenParams<ShoppingListStackParamList>;
  PantryStack: NavigatorScreenParams<PantryStackParamList>;
  SettingsStack: NavigatorScreenParams<SettingsStackParamList>;
  HomeManagementStack: NavigatorScreenParams<HomeManagementStackParamList>;
  NotFound: undefined;
};

export type HomeTabParamList = {
  Main: undefined;
  ShoppingList: undefined;
  Recipes: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  LandingAuth: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  RememberLoginInfo: {email: string; password: string};
  ResetPassword: {token: string};
  ChangePassword: undefined;
  ConfirmEmail: {email: string};
  CodeVerification: {email: string; password: string};
};

export type OnBoardingStackParamList = {
  CreateHome: undefined;
  CreateShoppingList: undefined;
  SelectPantryItems: undefined;
  InviteMembers: undefined;
  OnboardingComplete: undefined;
};

export type BarcodeStackParamList = {
  BarcodeScanner: undefined;
  SearchResults: {
    barcode: string;
    format: string;
  };
};

export type NotificationStackParamList = {
  NotificationList: undefined;
  NotificationDetail: {
    notification: NotificationItem;
  };
  NotificationSettings: undefined;
};

export type ShoppingListStackParamList = {
  ShoppingListMain: undefined;
  AddItem: {
    listId?: string;
  };
  EditItem: {
    listId: string;
    itemId: string;
  };
  ShareList: {
    listId: string;
  };
  ListSettings:
    | {
        listId?: string;
      }
    | undefined;
  AcceptInvite: {
    token?: string;
    inviteId?: string;
  };
  JoinList: {
    listId: string;
  };
};

export type PantryStackParamList = {
  PantryMain: undefined;
  PantryItemDetail: {
    itemId: string;
  };
  AddPantryItem: undefined;
  EditPantryItem: {
    itemId: string;
  };
  ExpiringItems: undefined;
  LowStockItems: undefined;
  CategoryManagement: undefined;
  HomeManagement: undefined;
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  ProfileSettings: undefined;
  NotificationSettings: undefined;
  AppearanceSettings: undefined;
  PrivacySettings: undefined;
  SecuritySettings: undefined;
  AccountSettings: undefined;
  DataExport: undefined;
  HelpSupport: undefined;
  About: undefined;
};

export type HomeManagementStackParamList = {
  HomeManagement: {
    selectedHomeId?: string;
  };
};
// ============================================================================
// ROOT & HOME TAB SCREEN PROPS
// ============================================================================

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  StackScreenProps<RootStackParamList, T>;

export type HomeTabScreenProps<T extends keyof HomeTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<HomeTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

// ============================================================================
// AUTH STACK TYPES
// ============================================================================

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  CompositeScreenProps<
    StackScreenProps<AuthStackParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

// Screen Props
export type LoginScreenProps = AuthStackScreenProps<'Login'>;
export type LoginScreenNavigationProps = LoginScreenProps['navigation'];
export type SignUpScreenProps = AuthStackScreenProps<'SignUp'>;
export type CodeVerificationScreenProps =
  AuthStackScreenProps<'CodeVerification'>;
export type RememberLoginInfoScreenProps =
  AuthStackScreenProps<'RememberLoginInfo'>;

// Navigation Props
export type LoginNavProp = StackNavigationProp<AuthStackParamList, 'Login'>;
export type SignUpNavProp = StackNavigationProp<AuthStackParamList, 'SignUp'>;
export type CodeVerificationNavProp = StackNavigationProp<
  AuthStackParamList,
  'CodeVerification'
>;
export type RememberNavProp = NativeStackNavigationProp<
  AuthStackParamList,
  'RememberLoginInfo'
>;

// Route Props
type RememberRouteProp = RouteProp<AuthStackParamList, 'RememberLoginInfo'>;

// Alternative Props Definition
export type RememberLoginInfoProps = {
  navigation: RememberNavProp;
  route: RememberRouteProp;
};

// ============================================================================
// ONBOARDING STACK TYPES
// ============================================================================

// Navigation Props
export type OnBoardingNavProp = StackNavigationProp<
  OnBoardingStackParamList,
  'CreateShoppingList'
>;
export type CreateShoppingListNavProp = NativeStackNavigationProp<
  OnBoardingStackParamList,
  'CreateShoppingList'
>;
export type CreateHomeNavProp = NativeStackNavigationProp<
  OnBoardingStackParamList,
  'CreateHome'
>;
export type SelectPantryItemsNavProp = NativeStackNavigationProp<
  OnBoardingStackParamList,
  'SelectPantryItems'
>;
export type InviteMembersNavProp = NativeStackNavigationProp<
  OnBoardingStackParamList,
  'InviteMembers'
>;
export type OnboardingCompleteNavProp = NativeStackNavigationProp<
  OnBoardingStackParamList,
  'OnboardingComplete'
>;

// ============================================================================
// BARCODE STACK TYPES
// ============================================================================

// Screen Props
export type BarcodeScannerScreenProps = NativeStackScreenProps<
  BarcodeStackParamList,
  'BarcodeScanner'
>;
export type SearchResultsScreenProps = NativeStackScreenProps<
  BarcodeStackParamList,
  'SearchResults'
>;

// Navigation Props
export type BarcodeScannerNavProp = NativeStackNavigationProp<
  BarcodeStackParamList,
  'BarcodeScanner'
>;
export type SearchResultsNavProp = NativeStackNavigationProp<
  BarcodeStackParamList,
  'SearchResults'
>;

// ============================================================================
// SHOPPING LIST STACK TYPES
// ============================================================================

// Screen Props
export type ShoppingListStackScreenProps<
  T extends keyof ShoppingListStackParamList,
> = CompositeScreenProps<
  NativeStackScreenProps<ShoppingListStackParamList, T>,
  StackScreenProps<RootStackParamList, keyof RootStackParamList>
>;

export type ShoppingListMainScreenProps =
  ShoppingListStackScreenProps<'ShoppingListMain'>;

export type AddItemScreenProps = ShoppingListStackScreenProps<'AddItem'>;
export type EditItemScreenProps = ShoppingListStackScreenProps<'EditItem'>;
export type ShareListScreenProps = ShoppingListStackScreenProps<'ShareList'>;
export type ListSettingsScreenProps =
  ShoppingListStackScreenProps<'ListSettings'>;

export type ListSettingsRouteProp = RouteProp<
  ShoppingListStackParamList,
  'ListSettings'
>;

// Navigation Props
export type ShoppingListMainNavProp = NativeStackNavigationProp<
  ShoppingListStackParamList,
  'ShoppingListMain'
>;

export type AddItemNavProp = NativeStackNavigationProp<
  ShoppingListStackParamList,
  'AddItem'
>;
export type EditItemNavProp = NativeStackNavigationProp<
  ShoppingListStackParamList,
  'EditItem'
>;

export type ListSettingsNavProp = NativeStackNavigationProp<
  ShoppingListStackParamList,
  'ListSettings'
>;

export type EditItemRouteProp = RouteProp<
  ShoppingListStackParamList,
  'EditItem'
>;

// ============================================================================
// PANTRY STACK TYPES
// ============================================================================

// Screen Props
export type PantryStackScreenProps<T extends keyof PantryStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<PantryStackParamList, T>,
    StackScreenProps<RootStackParamList, keyof RootStackParamList>
  >;

export type PantryMainScreenProps = PantryStackScreenProps<'PantryMain'>;
export type PantryItemDetailScreenProps =
  PantryStackScreenProps<'PantryItemDetail'>;
export type AddPantryItemScreenProps = PantryStackScreenProps<'AddPantryItem'>;
export type EditPantryItemScreenProps =
  PantryStackScreenProps<'EditPantryItem'>;
export type ExpiringItemsScreenProps = PantryStackScreenProps<'ExpiringItems'>;
export type LowStockItemsScreenProps = PantryStackScreenProps<'LowStockItems'>;
export type CategoryManagementScreenProps =
  PantryStackScreenProps<'CategoryManagement'>;

// Navigation Props
export type PantryMainNavProp = NativeStackNavigationProp<
  PantryStackParamList,
  'PantryMain'
>;
export type PantryItemDetailNavProp = NativeStackNavigationProp<
  PantryStackParamList,
  'PantryItemDetail'
>;
export type AddPantryItemNavProp = NativeStackNavigationProp<
  PantryStackParamList,
  'AddPantryItem'
>;
export type EditPantryItemNavProp = NativeStackNavigationProp<
  PantryStackParamList,
  'EditPantryItem'
>;
export type ExpiringItemsNavProp = NativeStackNavigationProp<
  PantryStackParamList,
  'ExpiringItems'
>;
export type LowStockItemsNavProp = NativeStackNavigationProp<
  PantryStackParamList,
  'LowStockItems'
>;

// Route Props
export type PantryItemDetailRouteProp = RouteProp<
  PantryStackParamList,
  'PantryItemDetail'
>;
export type EditPantryItemRouteProp = RouteProp<
  PantryStackParamList,
  'EditPantryItem'
>;

// ============================================================================
// SETTINGS STACK TYPES
// ============================================================================

// Screen Props
export type SettingsStackScreenProps<T extends keyof SettingsStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<SettingsStackParamList, T>,
    StackScreenProps<RootStackParamList, keyof RootStackParamList>
  >;

export type SettingsMainScreenProps = SettingsStackScreenProps<'SettingsMain'>;
export type ProfileSettingsScreenProps =
  SettingsStackScreenProps<'ProfileSettings'>;
export type NotificationSettingsScreenProps =
  SettingsStackScreenProps<'NotificationSettings'>;
export type AppearanceSettingsScreenProps =
  SettingsStackScreenProps<'AppearanceSettings'>;
export type PrivacySettingsScreenProps =
  SettingsStackScreenProps<'PrivacySettings'>;
export type SecuritySettingsScreenProps =
  SettingsStackScreenProps<'SecuritySettings'>;
export type AccountSettingsScreenProps =
  SettingsStackScreenProps<'AccountSettings'>;

// Navigation Props
export type SettingsMainNavProp = NativeStackNavigationProp<
  SettingsStackParamList,
  'SettingsMain'
>;
export type ProfileSettingsNavProp = NativeStackNavigationProp<
  SettingsStackParamList,
  'ProfileSettings'
>;
export type NotificationSettingsNavProp = NativeStackNavigationProp<
  SettingsStackParamList,
  'NotificationSettings'
>;

// ============================================================================
// NOTIFICATION STACK TYPES
// ============================================================================

// Screen Props
export type NotificationStackScreenProps<
  T extends keyof NotificationStackParamList,
> = CompositeScreenProps<
  NativeStackScreenProps<NotificationStackParamList, T>,
  StackScreenProps<RootStackParamList, keyof RootStackParamList>
>;
export type NotificationListScreenProps =
  NotificationStackScreenProps<'NotificationList'>;

export type NotificationDetailScreenProps =
  NotificationStackScreenProps<'NotificationDetail'>;

// Navigation Props
export type NotificationListNavProp = NativeStackNavigationProp<
  NotificationStackParamList,
  'NotificationList'
>;
export type NotificationDetailNavProp = NativeStackNavigationProp<
  NotificationStackParamList,
  'NotificationDetail'
>;

// ============================================================================
// HOME MANAGEMENT STACK TYPES
// ============================================================================

// Screen Props
export type HomeManagementStackScreenProps<
  T extends keyof HomeManagementStackParamList,
> = CompositeScreenProps<
  NativeStackScreenProps<HomeManagementStackParamList, T>,
  StackScreenProps<RootStackParamList, keyof RootStackParamList>
>;

export type HomeManagementScreenProps =
  HomeManagementStackScreenProps<'HomeManagement'>;

// Navigation Props
export type HomeManagementNavProp = NativeStackNavigationProp<
  HomeManagementStackParamList,
  'HomeManagement'
>;

// ============================================================================
// COMMON NAVIGATION PROPS
// ============================================================================

export type RootNavProp = StackNavigationProp<RootStackParamList>;
export type MainNavProp = BottomTabNavigationProp<HomeTabParamList, 'Main'>;

// ============================================================================
// GLOBAL NAVIGATION DECLARATION
// ============================================================================

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
