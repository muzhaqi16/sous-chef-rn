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

export const OnboardingStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
    inactiveBehavior: 'none',
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
    ImageCrop: ImageCropScreen,
    InviteMembers: createNativeStackScreen({
      screen: InviteMemberScreen,
      linking: 'onboarding/invite',
    }),
    OnboardingComplete: createNativeStackScreen({
      screen: OnboardingCompleteScreen,
      linking: 'onboarding/complete',
    }),
    BiometricSetup: BiometricSetupScreen,
  },
});

export type OnboardingStackParams = StaticParamList<typeof OnboardingStack>;
