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
  // Top safe-area inset, applied per screen (it's no longer global — see
  // TopInsetLayout). No immersive screen here, so inset every screen.
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
    // `linking: null` — intentionally not deep-linkable; only reachable
    // mid-onboarding from ProfilePictureUpload. Omitting the key is NOT the
    // same thing: linking runs in `auto` mode, which hands any screen without
    // an explicit config a path derived from its name.
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
    // `linking: null` — intentionally not deep-linkable; reached only at the end
    // of the onboarding flow. Without it, auto mode derives `biometric-setup`
    // here AND on RootNavigator's post-login BiometricSetup screen, and two
    // screens claiming one pattern make the whole linking config throw.
    BiometricSetup: createNativeStackScreen({
      screen: BiometricSetupScreen,
      linking: null,
    }),
  },
});

export type OnboardingStackParams = StaticParamList<typeof OnboardingStack>;
