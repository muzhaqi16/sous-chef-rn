import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { RecipeMain } from '#features/recipes/screens/RecipeMain';
import { RecipeFormScreen } from '#features/recipes/screens/RecipeForm';
import { SavedRecipes } from '#features/recipes/screens/SavedRecipes';
import { MyRecipes } from '#features/recipes/screens/MyRecipes';
import { RecipeDetail } from '#features/recipes/screens/RecipeDetail';
import {
  topInsetScreenLayout,
  noInsetScreenLayout,
} from '#navigation/layouts/TopInsetLayout';

// Detail/sub screens nested under Recipe's own stack, isolating this tab's
// Offscreen-pause boundary from the other 3 tabs (see RootNavigator's `Home`
// comment and PantryStack.tsx). Tab bar visibility is handled the same way
// as Pantry's/ShoppingList's — derived from navigation state in `FloatingTabBar`.
const detailScreenOptions = {
  fullScreenGestureEnabled: true,
  animationDuration: 250,
};

export const RecipeStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    contentStyle: { backgroundColor: theme.colors.background },
    // Confirmed fix (via controlled A/B revert) — see PantryStack.tsx's
    // identical comment and CLAUDE.md's `inactiveBehavior` section.
    inactiveBehavior: 'none',
  }),
  screenLayout: topInsetScreenLayout,
  screens: {
    RecipeMain: createNativeStackScreen({
      screen: RecipeMain,
      linking: 'recipes',
    }),
    // RecipeCreate/RecipeEdit share RecipeFormScreen (distinguished by route
    // params, not route name) and are moved here in full — MyRecipes and
    // RecipeDetail (their only callers) are both nested here too.
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
    // Duplicate registration (also nested in PantryStack, still root-level
    // for MealPlan until its own migration phase) — mirrors the
    // pre-June-2026 structure, matching this codebase's own established
    // pattern for a screen reached from multiple tabs.
    RecipeDetail: createNativeStackScreen({
      screen: RecipeDetail,
      layout: noInsetScreenLayout,
      options: detailScreenOptions,
      linking: null,
    }),
  },
});

export type RecipeStackParams = StaticParamList<typeof RecipeStack>;
