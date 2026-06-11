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
import {
  topInsetScreenLayout,
  noInsetScreenLayout,
} from '#navigation/layouts/TopInsetLayout';

export const RecipeStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
    inactiveBehavior: 'none',
  }),
  // Top safe-area inset is the stack-wide default; RecipeDetail opts out to
  // draw its hero image edge-to-edge behind the status bar.
  screenLayout: topInsetScreenLayout,
  screens: {
    RecipeMain: createNativeStackScreen({
      screen: RecipeMain,
      linking: 'recipes',
    }),
    RecipeDetail: createNativeStackScreen({
      screen: RecipeDetail,
      layout: noInsetScreenLayout,
    }),
    RecipeCreate: createNativeStackScreen({
      screen: RecipeFormScreen,
    }),
    RecipeEdit: createNativeStackScreen({
      screen: RecipeFormScreen,
    }),
    SavedRecipes: createNativeStackScreen({
      screen: SavedRecipes,
      linking: 'recipes/saved',
    }),
    MyRecipes: createNativeStackScreen({
      screen: MyRecipes,
      linking: 'recipes/mine',
    }),
  },
});

export type RecipeStackParams = StaticParamList<typeof RecipeStack>;
