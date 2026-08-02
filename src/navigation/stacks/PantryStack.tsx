import React from 'react';
import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { PantryMain } from '#features/pantry/screens/PantryMain';
import { PantryItemScreen } from '#features/pantry/screens/PantryItemScreen';
import { PantryItemDetail } from '#features/pantry/screens/PantryItemDetail';
import { FilteredPantryItems } from '#features/pantry/screens/FilteredPantryItems';
import { PantrySettings } from '#features/pantry/screens/PantrySettings';
import { NutritionScreen } from '#features/pantry/screens/NutritionScreen';
import { RecipeDetail } from '#features/recipes/screens/RecipeDetail';
import { ProfileScreen } from '#features/profile/screens/ProfileScreen';
import { HomeManagement } from '#screens/home/HomeManagement';
import { HomeDetailScreen } from '#screens/home/HomeDetailScreen';
import { StorageLocationsScreen } from '#screens/home/StorageLocationsScreen';
import {
  topInsetScreenLayout,
  noInsetScreenLayout,
} from '#navigation/layouts/TopInsetLayout';

// Lazy-load PantryAnalytics to defer Skia + victory-native JS loading.
const PantryAnalytics = React.lazy(() =>
  import('#features/pantry/screens/PantryAnalytics').then(m => ({
    default: m.PantryAnalytics,
  })),
);

// Lazy-loaded Profile sub-screens (infrequently visited, reduces cold start JS
// parsing) — moved here from RootNavigator.tsx. All are reached only via
// Pantry's header (avatar/bell/home-switcher) or ProfileScreen's own settings
// rows, so — unlike RecipeDetail/HomeDetail/StorageLocations above/below —
// none of these need a duplicate registration elsewhere.
const ProfilePhotoUploadScreen = React.lazy(
  () => import('#features/profile/screens/ProfilePhotoUploadScreen'),
);
const ImageCropScreen = React.lazy(
  () => import('#features/profile/screens/ImageCropScreen'),
);
const DeleteAccountScreen = React.lazy(
  () => import('#features/profile/screens/DeleteAccountScreen'),
);
const DietaryProfileScreen = React.lazy(
  () => import('#features/profile/screens/DietaryProfileScreen'),
);
const AppSettingsScreen = React.lazy(
  () => import('#features/profile/screens/AppSettingsScreen'),
);
const PersonalInformationScreen = React.lazy(
  () => import('#features/profile/screens/PersonalInformationScreen'),
);
const PerformanceDashboard = React.lazy(
  () => import('#features/profile/screens/PerformanceDashboard'),
);
const DebugInfo = React.lazy(
  () => import('#features/profile/screens/DebugInfo'),
);
const ChangePasswordScreen = React.lazy(
  () => import('#features/profile/screens/ChangePasswordScreen'),
);
const NotificationSettingsScreen = React.lazy(
  () => import('#features/notifications/screens/NotificationSettingsScreen'),
);
const AppearanceScreen = React.lazy(
  () => import('#features/profile/screens/AppearanceScreen'),
);

// Detail/sub screens nested under Pantry's own stack, isolating this tab's
// Offscreen-pause boundary from the other 3 tabs (see RootNavigator's `Home`
// comment). The floating tab bar's visibility is derived directly from
// navigation state in `FloatingTabBar` itself (hidden whenever the focused
// tab's nested stack index isn't 0) — these screens don't need to do
// anything to hide it.
const detailScreenOptions = {
  fullScreenGestureEnabled: true,
  animationDuration: 250,
};

export const PantryStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    contentStyle: { backgroundColor: theme.colors.background },
    // Keeps PantryMain's subtree (FlashList + every item cell's animation/
    // gesture effects) running while blurred instead of tearing it down and
    // re-running it all synchronously on resume — see CLAUDE.md's
    // `inactiveBehavior` section.
    inactiveBehavior: 'none',
  }),
  // Top safe-area inset for the main screen (Home opts out of the inset and
  // delegates it to each tab's stack — see RootNavigator).
  screenLayout: topInsetScreenLayout,
  screens: {
    PantryMain: createNativeStackScreen({
      screen: PantryMain,
      linking: 'pantry',
    }),
    PantryItem: createNativeStackScreen({
      screen: PantryItemScreen,
      options: detailScreenOptions,
      linking: null,
    }),
    PantryItemDetail: createNativeStackScreen({
      screen: PantryItemDetail,
      layout: noInsetScreenLayout,
      options: detailScreenOptions,
      linking: null,
    }),
    FilteredPantryItems: createNativeStackScreen({
      screen: FilteredPantryItems,
      options: detailScreenOptions,
      linking: null,
    }),
    PantrySettings: createNativeStackScreen({
      screen: PantrySettings,
      options: detailScreenOptions,
      linking: null,
    }),
    PantryAnalytics: createNativeStackScreen({
      screen: PantryAnalytics,
      options: detailScreenOptions,
      linking: null,
    }),
    NutritionScreen: createNativeStackScreen({
      screen: NutritionScreen,
      options: detailScreenOptions,
      linking: null,
    }),
    // Duplicate registration (also nested in RecipeStack/MealPlanStack) —
    // mirrors the pre-June-2026 structure, matching this codebase's own
    // established pattern for a screen reached from multiple tabs.
    RecipeDetail: createNativeStackScreen({
      screen: RecipeDetail,
      layout: noInsetScreenLayout,
      options: detailScreenOptions,
      linking: null,
    }),
    // Profile + home-management screens — moved here in full from
    // RootNavigator.tsx (not duplicated: PantryMain's header is their only
    // entry point). Linking strings are preserved unchanged from their root
    // registration where they had one; nested screens support their own
    // `linking` path same as PantryMain's `linking: 'pantry'` above.
    Profile: createNativeStackScreen({
      screen: ProfileScreen,
      options: { animation: 'slide_from_right', animationDuration: 200 },
      linking: null,
    }),
    HomeManagement: createNativeStackScreen({
      screen: HomeManagement,
      linking: 'home-management/:selectedHomeId?',
    }),
    // Duplicate registration — ShareList/ListSettings (not yet migrated; see
    // ShoppingListStack phase) still reach the root-level HomeDetail copy
    // directly, so it stays registered at root too until their migration.
    // This copy is what HomeManagement (now nested here) reaches.
    HomeDetail: createNativeStackScreen({
      screen: HomeDetailScreen,
      options: {
        presentation: 'card',
        animation: 'slide_from_right',
      },
      linking: null,
    }),
    // Duplicate registration for the same reason as HomeDetail above — only
    // ever reached from wherever HomeDetail itself is currently rendered.
    StorageLocations: createNativeStackScreen({
      screen: StorageLocationsScreen,
      options: { presentation: 'card', animation: 'slide_from_right' },
      linking: null,
    }),
    ProfilePhotoUpload: createNativeStackScreen({
      screen: ProfilePhotoUploadScreen,
      options: {
        presentation: 'card',
        animation: 'slide_from_bottom',
      },
      linking: 'upload-photo',
    }),
    ImageCrop: createNativeStackScreen({
      screen: ImageCropScreen,
      options: {
        presentation: 'modal',
        animation: 'slide_from_bottom',
      },
      linking: 'crop-image',
    }),
    DeleteAccount: createNativeStackScreen({
      screen: DeleteAccountScreen,
      linking: 'delete-account',
    }),
    NotificationSettings: createNativeStackScreen({
      screen: NotificationSettingsScreen,
      options: { animation: 'fade', animationDuration: 150 },
      linking: null,
    }),
    DietaryProfile: createNativeStackScreen({
      screen: DietaryProfileScreen,
      options: { animation: 'fade', animationDuration: 150 },
      linking: null,
    }),
    PersonalInformation: createNativeStackScreen({
      screen: PersonalInformationScreen,
      options: { animation: 'fade', animationDuration: 150 },
      linking: null,
    }),
    AppSettings: createNativeStackScreen({
      screen: AppSettingsScreen,
      options: { animation: 'fade', animationDuration: 150 },
      linking: null,
    }),
    PerformanceDashboard: createNativeStackScreen({
      screen: PerformanceDashboard,
      options: { animation: 'fade', animationDuration: 150 },
      linking: null,
    }),
    DebugInfo: createNativeStackScreen({
      screen: DebugInfo,
      options: { animation: 'fade', animationDuration: 150 },
      linking: null,
    }),
    ChangePassword: createNativeStackScreen({
      screen: ChangePasswordScreen,
      options: { animation: 'fade', animationDuration: 150 },
      linking: null,
    }),
    Appearance: createNativeStackScreen({
      screen: AppearanceScreen,
      options: { animation: 'fade', animationDuration: 150 },
      linking: null,
    }),
  },
});

export type PantryStackParams = StaticParamList<typeof PantryStack>;
