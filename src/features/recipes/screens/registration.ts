import { createNativeStackScreen } from '@react-navigation/native-stack';
import { noInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';
import { detailScreenOptions } from '#navigation/detailScreenOptions';
import { RecipeDetail } from './RecipeDetail';
import { RecipeFormScreen } from './RecipeForm';
import { SavedRecipes } from './SavedRecipes';
import { MyRecipes } from './MyRecipes';

/**
 * Recipe's detail/sub screens, siblings of `Home` (see RootNavigator). ONE
 * `RecipeDetail` serves all three tabs that open it; being root-level rather
 * than per-tab is what keeps its own navigation actions from jumping the user
 * to a fixed tab.
 */
export const recipeDetailScreens = {
  RecipeDetail: createNativeStackScreen({
    screen: RecipeDetail,
    // Hero screen — draws edge-to-edge, so it opts out of the top inset.
    layout: noInsetScreenLayout,
    options: detailScreenOptions,
    linking: null,
  }),
  // RecipeCreate/RecipeEdit share RecipeFormScreen, distinguished by route
  // params rather than by which component renders.
  RecipeCreate: createNativeStackScreen({
    screen: RecipeFormScreen,
    options: detailScreenOptions,
    linking: null,
  }),
  RecipeEdit: createNativeStackScreen({
    screen: RecipeFormScreen,
    options: detailScreenOptions,
    linking: null,
  }),
  SavedRecipes: createNativeStackScreen({
    screen: SavedRecipes,
    options: detailScreenOptions,
    linking: null,
  }),
  MyRecipes: createNativeStackScreen({
    screen: MyRecipes,
    options: detailScreenOptions,
    linking: null,
  }),
};
