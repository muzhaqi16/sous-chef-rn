import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { RecipeMain } from '#features/recipes/screens/RecipeMain';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

// Single-screen stack: the Recipe tab's main screen. All detail/sub screens
// (RecipeDetail, RecipeCreate, SavedRecipes, …) are registered at the root
// level in RootNavigator — as siblings of the tab navigator — so the floating
// tab bar is never mounted on them and cannot get stuck hidden.
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
