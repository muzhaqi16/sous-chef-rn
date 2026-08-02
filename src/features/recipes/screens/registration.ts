import { createNativeStackScreen } from '@react-navigation/native-stack';
import { noInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';
import { detailScreenOptions } from '#navigation/detailScreenOptions';
import { RecipeDetail } from './RecipeDetail';
import { RecipeFormScreen } from './RecipeForm';
import { SavedRecipes } from './SavedRecipes';
import { MyRecipes } from './MyRecipes';

/**
 * Recipe's detail/sub screens, registered as siblings of `Home` — see
 * RootNavigator and `pantryDetailScreens` for why the app registers detail
 * screens there rather than inside a tab's stack.
 *
 * A single `RecipeDetail` serves all three tabs that open it (Pantry, Recipe,
 * MealPlan). Because it is root-level rather than duplicated per tab, its own
 * "open the fork I just made" / "edit this recipe" actions stay put instead of
 * jumping the user to a fixed tab.
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
