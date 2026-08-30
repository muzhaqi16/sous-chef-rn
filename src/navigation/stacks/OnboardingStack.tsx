import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { CreateHomeScreen } from '#screens/onBoarding/createHome/CreateHomeScreen';
import { CreateShoppingListScreen } from '#screens/onBoarding/CreateShoppingListScreen';
import { SelectPantryItems } from '#screens/onBoarding/SelectPantryItems';
import { ProfilePictureUploadScreen } from '#screens/onBoarding/ProfilePictureUploadScreen';
import { InviteMemberScreen } from '#screens/onBoarding/InviteMemberScreen';
import { OnboardingCompleteScreen } from '#screens/onBoarding/OnboardingCompleteScreen';
import { BiometricSetupScreen } from '#screens/onBoarding/BiometricSetupScreen';
import { ImageCropScreen } from '#features/profile/screens/ImageCropScreen';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

export const OnboardingStack = createNativeStackNavigator({
  // Per-screen top inset (see TopInsetLayout); nothing immersive here.
  screenLayout: topInsetScreenLayout,
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screens: {
    CreateHome: createNativeStackScreen({
      screen: CreateHomeScreen,
      linking: 'onboarding/home',
    }),
    CreateShoppingList: createNativeStackScreen({
      screen: CreateShoppingListScreen,
      linking: 'onboarding/shopping-list',
    }),
    SelectPantryItems: createNativeStackScreen({
      screen: SelectPantryItems,
      linking: 'onboarding/pantry-items',
    }),
    ProfilePictureUpload: createNativeStackScreen({
      screen: ProfilePictureUploadScreen,
      linking: 'onboarding/profile-picture',
    }),
    // `linking: null` is not the same as omitting the key: linking runs in `auto`
    // mode, which derives a path from the screen name for anything unconfigured.
    ImageCrop: createNativeStackScreen({
      screen: ImageCropScreen,
      linking: null,
    }),
    InviteMembers: createNativeStackScreen({
      screen: InviteMemberScreen,
      linking: 'onboarding/invite',
    }),
    OnboardingComplete: createNativeStackScreen({
      screen: OnboardingCompleteScreen,
      linking: 'onboarding/complete',
    }),
    // Without `linking: null`, auto mode derives `biometric-setup` here AND on
    // RootNavigator's post-login screen, and two claims on one pattern throw.
    BiometricSetup: createNativeStackScreen({
      screen: BiometricSetupScreen,
      linking: null,
    }),
  },
});

export type OnboardingStackParams = StaticParamList<typeof OnboardingStack>;
