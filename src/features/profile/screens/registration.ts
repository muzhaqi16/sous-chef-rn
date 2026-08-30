import React from 'react';
import { createNativeStackScreen } from '@react-navigation/native-stack';
import { settingsScreenOptions } from '#navigation/detailScreenOptions';
import { ProfileScreen } from './ProfileScreen';

// Infrequently visited, so loaded on demand to keep them out of cold start.
const ProfilePhotoUploadScreen = React.lazy(
  () => import('./ProfilePhotoUploadScreen'),
);
const ImageCropScreen = React.lazy(() => import('./ImageCropScreen'));
const DeleteAccountScreen = React.lazy(() => import('./DeleteAccountScreen'));
const DietaryProfileScreen = React.lazy(() => import('./DietaryProfileScreen'));
const AppSettingsScreen = React.lazy(() => import('./AppSettingsScreen'));
const PersonalInformationScreen = React.lazy(
  () => import('./PersonalInformationScreen'),
);
const PerformanceDashboard = React.lazy(() => import('./PerformanceDashboard'));
const DebugInfo = React.lazy(() => import('./DebugInfo'));
const ChangePasswordScreen = React.lazy(() => import('./ChangePasswordScreen'));
const AppearanceScreen = React.lazy(() => import('./AppearanceScreen'));
// Owned by the notifications feature but only ever reached from Profile's
// settings rows, so it is registered alongside them.
const NotificationSettingsScreen = React.lazy(
  () => import('#features/notifications/screens/NotificationSettingsScreen'),
);
// Same arrangement: an auth screen, but from inside the app it is only ever
// reached from Profile's verify-email banner (and the collaborate gate's
// alert). Registered here as a sibling of `Home` so it PUSHES over the app —
// the root navigator's `verification` group is a different thing, a gate with
// no app behind it, and swapping to it is what used to strand the user on Home
// after verifying and offer sign-out as the only way back.
const VerifyEmailScreen = React.lazy(() =>
  import('#screens/auth/CodeVerificationScreen').then(m => ({
    default: m.VerifyEmailScreen,
  })),
);

/**
 * Profile and its settings screens, registered as siblings of `Home` — see
 * RootNavigator and `pantryDetailScreens` for the rationale.
 *
 * `ProfilePhotoUpload`, `ImageCrop` and `DeleteAccount` keep the deep-link
 * paths they have always had; every other screen here opts out with
 * `linking: null`.
 *
 * Onboarding registers its own `ImageCrop` inside `OnboardingStack` — that
 * copy exists so cropping during onboarding stays inside the onboarding flow,
 * and is reached with `toOnboardingImageCrop`.
 */
export const profileScreens = {
  Profile: createNativeStackScreen({
    screen: ProfileScreen,
    options: { animation: 'slide_from_right', animationDuration: 200 },
    linking: null,
  }),
  ProfilePhotoUpload: createNativeStackScreen({
    screen: ProfilePhotoUploadScreen,
    options: { presentation: 'card', animation: 'slide_from_bottom' },
    linking: 'upload-photo',
  }),
  ImageCrop: createNativeStackScreen({
    screen: ImageCropScreen,
    options: { presentation: 'modal', animation: 'slide_from_bottom' },
    linking: 'crop-image',
  }),
  DeleteAccount: createNativeStackScreen({
    screen: DeleteAccountScreen,
    linking: 'delete-account',
  }),
  NotificationSettings: createNativeStackScreen({
    screen: NotificationSettingsScreen,
    options: settingsScreenOptions,
    linking: null,
  }),
  VerifyEmail: createNativeStackScreen({
    screen: VerifyEmailScreen,
    options: settingsScreenOptions,
    linking: null,
  }),
  DietaryProfile: createNativeStackScreen({
    screen: DietaryProfileScreen,
    options: settingsScreenOptions,
    linking: null,
  }),
  PersonalInformation: createNativeStackScreen({
    screen: PersonalInformationScreen,
    options: settingsScreenOptions,
    linking: null,
  }),
  AppSettings: createNativeStackScreen({
    screen: AppSettingsScreen,
    options: settingsScreenOptions,
    linking: null,
  }),
  PerformanceDashboard: createNativeStackScreen({
    screen: PerformanceDashboard,
    options: settingsScreenOptions,
    linking: null,
  }),
  DebugInfo: createNativeStackScreen({
    screen: DebugInfo,
    options: settingsScreenOptions,
    linking: null,
  }),
  ChangePassword: createNativeStackScreen({
    screen: ChangePasswordScreen,
    options: settingsScreenOptions,
    linking: null,
  }),
  Appearance: createNativeStackScreen({
    screen: AppearanceScreen,
    options: settingsScreenOptions,
    linking: null,
  }),
};
