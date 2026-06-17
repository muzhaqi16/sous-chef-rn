import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { PantryMain } from '#features/pantry/screens/PantryMain';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

// Single-screen stack: the Pantry tab's main screen. All detail/sub screens
// (PantryItemDetail, PantrySettings, RecipeDetail, …) are registered at the
// root level in RootNavigator — as siblings of the tab navigator — so the
// floating tab bar is never mounted on them and cannot get stuck hidden.
export const PantryStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    contentStyle: { backgroundColor: theme.colors.background },
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
  },
});

export type PantryStackParams = StaticParamList<typeof PantryStack>;
