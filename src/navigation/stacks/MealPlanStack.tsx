import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { MealPlanMain } from '#features/mealPlan/screens/MealPlanMain';
import { CreateMealPlanScreen } from '#features/mealPlan/screens/CreateMealPlanScreen';
import { MealTemplateBuilderScreen } from '#features/mealPlan/screens/MealTemplateBuilderScreen';
import { RecipeDetail } from '#features/recipes/screens/RecipeDetail';
import {
  topInsetScreenLayout,
  noInsetScreenLayout,
} from '#navigation/layouts/TopInsetLayout';

// Detail/sub screens nested under MealPlan's own stack, isolating this tab's
// Offscreen-pause boundary from the other 3 tabs (see RootNavigator's `Home`
// comment and PantryStack.tsx). Tab bar visibility is handled the same way
// as the other tabs' — derived from navigation state in `FloatingTabBar`.
const detailScreenOptions = {
  fullScreenGestureEnabled: true,
  animationDuration: 250,
};

export const MealPlanStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    contentStyle: { backgroundColor: theme.colors.background },
    // Keeps this tab's screens running while blurred instead of tearing
    // them down on pause — see PantryStack.tsx and CLAUDE.md's
    // `inactiveBehavior` section.
    inactiveBehavior: 'none',
  }),
  screenLayout: topInsetScreenLayout,
  screens: {
    MealPlanMain: createNativeStackScreen({
      screen: MealPlanMain,
      linking: 'meal-plan',
    }),
    CreateMealPlan: createNativeStackScreen({
      screen: CreateMealPlanScreen,
      options: detailScreenOptions,
      linking: null,
    }),
    MealTemplateBuilder: createNativeStackScreen({
      screen: MealTemplateBuilderScreen,
      options: detailScreenOptions,
      linking: null,
    }),
    // Duplicate registration (also nested in PantryStack and RecipeStack) —
    // this is the LAST of the three consuming tabs to get its own copy, so
    // the shared root-level RecipeDetail registration in RootNavigator.tsx
    // is removed entirely as of this migration — see that file's comments.
    RecipeDetail: createNativeStackScreen({
      screen: RecipeDetail,
      layout: noInsetScreenLayout,
      options: detailScreenOptions,
      linking: null,
    }),
  },
});

export type MealPlanStackParams = StaticParamList<typeof MealPlanStack>;
