import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { PantryMain } from '#features/pantry/screens/PantryMain';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

// Single-screen stack: the Pantry tab's main screen. Its detail/sub screens
// are registered as siblings of `Home` (see features/pantry/screens/
// registration.ts) so a pushed detail screen covers the tab navigator and the
// floating tab bar is structurally absent on it.
export const PantryStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    contentStyle: { backgroundColor: theme.colors.background },
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
