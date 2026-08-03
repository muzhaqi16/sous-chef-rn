import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { RecipeMain } from '#features/recipes/screens/RecipeMain';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

// Single-screen stack — see PantryStack for why detail screens live at the
// root instead (features/recipes/screens/registration.ts).
export const RecipeStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screenLayout: topInsetScreenLayout,
  screens: {
    RecipeMain: createNativeStackScreen({
      screen: RecipeMain,
      linking: 'recipes',
    }),
  },
});

export type RecipeStackParams = StaticParamList<typeof RecipeStack>;
