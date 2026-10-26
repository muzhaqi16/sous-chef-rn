import React from 'react';
import { createNativeStackScreen } from '@react-navigation/native-stack';
import { settingsScreenOptions } from '#navigation/detailScreenOptions';
import { ProfileScreen } from './ProfileScreen';
import { devtoolsScreens } from '#features/devtools/screens/registration';
import { motion } from '#/theme/motion';

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
const ChangePasswordScreen = React.lazy(() => import('./ChangePasswordScreen'));
const AppearanceScreen = React.lazy(() => import('./AppearanceScreen'));
const DataSourcesScreen = React.lazy(() => import('./DataSourcesScreen'));
const MyReportsScreen = React.lazy(() => import('./MyReportsScreen'));
const BrandListsScreen = React.lazy(() =>
  import('./BrandListsScreen').then(m => ({ default: m.BrandListsScreen })),
);
const BrandListScreen = React.lazy(() =>
  import('./BrandListScreen').then(m => ({ default: m.BrandListScreen })),
);
// Owned by the notifications feature but only ever reached from Profile's
// settings rows, so it is registered alongside them.
const NotificationSettingsScreen = React.lazy(
  () => import('#features/notifications/screens/NotificationSettingsScreen'),
);
// Reached from inside the app, so a sibling of `Home` that PUSHES over it: the
// root's `verification` group is a gate with no app behind it, and swapping to
// it strands the user after verifying.
const VerifyEmailScreen = React.lazy(() =>
  import('#features/auth/screens/CodeVerificationScreen').then(m => ({
    default: m.VerifyEmailScreen,
  })),
);

/**
 * `Profile` and `ChangePassword` are email link targets; a new path also needs
 * claiming in the API's `apple-app-site-association` and `assetlinks.json`.
 * Onboarding registers its own `ImageCrop` so cropping stays in its flow.
 */
export const profileScreens = {
  Profile: createNativeStackScreen({
    screen: ProfileScreen,
    options: {
      animation: 'slide_from_right',
      animationDuration: motion.timing.STANDARD,
    },
    linking: 'profile',
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
  DataSources: createNativeStackScreen({
    screen: DataSourcesScreen,
    options: settingsScreenOptions,
    linking: null,
  }),
  MyReports: createNativeStackScreen({
    screen: MyReportsScreen,
    options: settingsScreenOptions,
    linking: null,
  }),
  BrandLists: createNativeStackScreen({
    screen: BrandListsScreen,
    options: settingsScreenOptions,
    linking: null,
  }),
  BrandList: createNativeStackScreen({
    screen: BrandListScreen,
    options: settingsScreenOptions,
    linking: null,
  }),
  ...devtoolsScreens,
  ChangePassword: createNativeStackScreen({
    screen: ChangePasswordScreen,
    options: settingsScreenOptions,
    linking: 'settings/change-password',
  }),
  Appearance: createNativeStackScreen({
    screen: AppearanceScreen,
    options: settingsScreenOptions,
    linking: null,
  }),
};
