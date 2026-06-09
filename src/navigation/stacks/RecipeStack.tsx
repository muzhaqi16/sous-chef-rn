import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { RecipeMain } from '#features/recipes/screens/RecipeMain';
import { RecipeDetail } from '#features/recipes/screens/RecipeDetail';
import { RecipeFormScreen } from '#features/recipes/screens/RecipeForm';
import { SavedRecipes } from '#features/recipes/screens/SavedRecipes';
import { MyRecipes } from '#features/recipes/screens/MyRecipes';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

export const RecipeStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
    inactiveBehavior: 'none',
  }),
  // Top safe-area inset is applied per screen (no longer global — see
  // TopInsetLayout). Every screen gets it EXCEPT RecipeDetail, which draws its
  // hero image edge-to-edge behind the status bar.
  screens: {
    RecipeMain: createNativeStackScreen({
      screen: RecipeMain,
      linking: 'recipes',
      layout: topInsetScreenLayout,
    }),
    RecipeDetail: createNativeStackScreen({
      screen: RecipeDetail,
    }),
    RecipeCreate: createNativeStackScreen({
      screen: RecipeFormScreen,
      layout: topInsetScreenLayout,
    }),
    RecipeEdit: createNativeStackScreen({
      screen: RecipeFormScreen,
      layout: topInsetScreenLayout,
    }),
    SavedRecipes: createNativeStackScreen({
      screen: SavedRecipes,
      linking: 'recipes/saved',
      layout: topInsetScreenLayout,
    }),
    MyRecipes: createNativeStackScreen({
      screen: MyRecipes,
      linking: 'recipes/mine',
      layout: topInsetScreenLayout,
    }),
  },
});

export type RecipeStackParams = StaticParamList<typeof RecipeStack>;
