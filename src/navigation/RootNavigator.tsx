import {
  createStaticNavigation,
  StaticParamList,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useStore} from '#store';
import {Icon} from '#/utils';
// Import all your screens
import {
  LoginScreen,
  SignUpScreen,
  ForgotPasswordScreen,
  CodeVerificationScreen,
  LandingAuthScreen,
  CreateHomeScreen,
  CreateShoppingListScreen,
  SelectPantryItems,
  ProfilePictureUploadScreen,
  InviteMembersScreen,
  OnboardingCompleteScreen,
  PantryMain,
  PantryItemScreen,
  PantryItemDetail,
  ExpiringItems,
  LowStockItems,
  CategoryManagement,
  PantrySettings,
  ShoppingListMain,
  ListSettings,
  ShareList,
  AddEditItem,
  ProfileScreen,
  HomeManagement,
  BarcodeScannerScreen,
  SearchResultsScreen,
  NotificationListScreen,
  NotificationDetailScreen,
  NotificationSettingsScreen,
  ProfilePhotoUploadScreen,
  ImageCropScreen,
  NotFoundScreen,
} from '#screens';

// Authentication hooks
const useIsAuthenticated = () => {
  const {user, isHydrated} = useStore();
  return isHydrated && !!user;
};

const useIsNotAuthenticated = () => {
  const {user, isHydrated} = useStore();
  return isHydrated && !user;
};

const useNeedsVerification = () => {
  const {user, isHydrated} = useStore();
  return isHydrated && !!user && !user.emailVerified;
};

const useNeedsOnboarding = () => {
  const {user, isHydrated} = useStore();
  return isHydrated && !!user && user.emailVerified && !user.onBoarded;
};

const useIsFullyAuthenticated = () => {
  const {user, isHydrated} = useStore();
  return isHydrated && !!user && user.emailVerified && user.onBoarded === true;
};

const useHasStoredCredentials = () => {
  const {hasStoredCredentials} = useStore();
  return hasStoredCredentials;
};

// Auth Stack
const AuthStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    animation: 'slide_from_right',
  },
  screens: {
    LandingAuth: {
      screen: LandingAuthScreen,
      if: () => {
        const {rememberMe, hasStoredCredentials} = useStore();
        return !hasStoredCredentials && rememberMe === undefined;
      },
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
      linking: 'verify/:email?',
    },
  },
});

// Onboarding Stack
const OnboardingStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    animation: 'slide_from_right',
  },
  screens: {
    CreateHome: {
      screen: CreateHomeScreen,
      linking: 'onboarding/home',
    },
    CreateShoppingList: {
      screen: CreateShoppingListScreen,
      linking: 'onboarding/shopping-list',
    },
    SelectPantryItems: {
      screen: SelectPantryItems,
      linking: 'onboarding/pantry-items',
    },
    ProfilePictureUpload: {
      screen: ProfilePictureUploadScreen,
      linking: 'onboarding/profile-picture',
    },
    InviteMembers: {
      screen: InviteMembersScreen,
      linking: 'onboarding/invite',
    },
    OnboardingComplete: {
      screen: OnboardingCompleteScreen,
      linking: 'onboarding/complete',
    },
  },
});

// Pantry Stack
const PantryStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
  },
  screens: {
    PantryMain: {
      screen: PantryMain,
    },
    PantryItem: {
      screen: PantryItemScreen,
    },
    PantryItemDetail: {
      screen: PantryItemDetail,
    },
    ExpiringItems: {
      screen: ExpiringItems,
    },
    LowStockItems: {
      screen: LowStockItems,
    },
    CategoryManagement: {
      screen: CategoryManagement,
    },
    PantrySettings: {
      screen: PantrySettings,
    },
  },
});

// Shopping List Stack
const ShoppingListStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
  },
  screens: {
    ShoppingListMain: {
      screen: ShoppingListMain,
    },
    ListSettings: {
      screen: ListSettings,
    },
    ShareList: {
      screen: ShareList,
    },
    AddItem: {
      screen: AddEditItem,
    },
  },
});

// Home Tabs
const HomeTabs = createBottomTabNavigator({
  screenOptions: ({route}) => ({
    headerShown: false,
    tabBarHideOnKeyboard: true,
    // tint colors
    tabBarIcon: ({focused, color, size}) => {
      let iconName: string;
      switch (route.name) {
        case 'Main':
          iconName = focused ? 'home' : 'home-outline';
          break;
        case 'ShoppingList':
          iconName = focused ? 'list' : 'list-outline';
          break;
        case 'Profile':
          iconName = focused ? 'person' : 'person-outline';
          break;
        default:
          iconName = 'help-circle';
      }
      return (
        <Icon library="Ionicons" name={iconName} size={size} color={color} />
      );
    },
  }),
  screens: {
    Main: {
      screen: PantryStack,
      options: {title: 'Pantry'},
    },
    ShoppingList: {
      screen: ShoppingListStack,
      options: {title: 'Shopping List'},
    },
    Profile: {
      screen: ProfileScreen,
      options: {title: 'Profile'},
    },
  },
});

// Barcode Stack
const BarcodeStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
  },
  screens: {
    BarcodeScanner: {
      screen: BarcodeScannerScreen,
      linking: 'scan',
    },
    SearchResults: {
      screen: SearchResultsScreen,
      linking: 'scan/result',
    },
  },
});

// Notification Stack
const NotificationStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
  },
  screens: {
    NotificationList: {
      screen: NotificationListScreen,
      linking: 'notifications',
    },
    NotificationDetail: {
      screen: NotificationDetailScreen,
      linking: 'notifications/:id',
    },
    NotificationSettings: {
      screen: NotificationSettingsScreen,
      linking: 'notifications/settings',
    },
  },
});

// Home Management Stack
const HomeManagementStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
  },
  screens: {
    HomeManagement: {
      screen: HomeManagement,
      linking: 'home-management',
    },
  },
});

// Root Stack with conditional rendering
export const RootStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
  },
  groups: {
    // Auth group - only shown when not authenticated
    auth: {
      if: useIsNotAuthenticated,
      screenOptions: {
        animation: 'fade',
      },
      screens: {
        AuthStack: {
          screen: AuthStack,
        },
      },
    },
    // Verification group
    verification: {
      if: useNeedsVerification,
      screens: {
        CodeVerificationDirect: {
          screen: CodeVerificationScreen,
        },
      },
    },
    // Onboarding group
    onboarding: {
      if: useNeedsOnboarding,
      screens: {
        OnBoardingStack: {
          screen: OnboardingStack,
        },
      },
    },
    // Main app group - only shown when fully authenticated
    main: {
      if: useIsFullyAuthenticated,
      screens: {
        HomeStack: {
          screen: HomeTabs,
          linking: 'app',
        },
        HomeManagementStack: {
          screen: HomeManagementStack,
        },
        BarcodeStack: {
          screen: BarcodeStack,
        },
        NotificationStack: {
          screen: NotificationStack,
        },
        ProfilePhotoUpload: {
          screen: ProfilePhotoUploadScreen,
          linking: 'upload-photo',
        },
        ImageCrop: {
          screen: ImageCropScreen,
          linking: 'crop-image',
        },
      },
    },
  },
  screens: {
    // Always available
    NotFound: {
      screen: NotFoundScreen,
      linking: '*',
    },
  },
});

// Create the navigation component
export const Navigation = createStaticNavigation(RootStack);

// TypeScript types
export type RootStackParamList = StaticParamList<typeof RootStack>;

// Global type declaration for useNavigation
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
