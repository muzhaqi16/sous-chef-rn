import { createNativeStackScreen } from '@react-navigation/native-stack';
import { ImageCropScreen } from '#features/profile/screens/ImageCropScreen';
import { CreateHomeScreen } from './createHome/CreateHomeScreen';
import { CreateShoppingListScreen } from './CreateShoppingListScreen';
import { SelectPantryItems } from './SelectPantryItems';
import { ProfilePictureUploadScreen } from './ProfilePictureUploadScreen';
import { InviteMemberScreen } from './InviteMemberScreen';
import { OnboardingCompleteScreen } from './OnboardingCompleteScreen';
import { BiometricSetupScreen } from './BiometricSetupScreen';

/**
 * The onboarding stack's screens, spread into `OnboardingStack`. Must stay a
 * literal — react-navigation infers per-screen param types only from one.
 * `linking: null` differs from omitting a key: linking runs in `auto` mode and
 * would otherwise derive a path from the screen name.
 */
export const onboardingScreens = {
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
  // Onboarding registers its own ImageCrop so cropping stays inside the flow.
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
};
