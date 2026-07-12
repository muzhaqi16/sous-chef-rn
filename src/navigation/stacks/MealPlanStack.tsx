import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { MealPlanMain } from '#features/mealPlan/screens/MealPlanMain';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

// Single-screen stack: the Meal Plan tab's main screen. Its detail/sub screens
// (CreateMealPlan, RecipeDetail) are registered at the root level in
// RootNavigator — as siblings of the tab navigator — so the floating tab bar is
// never mounted on them and cannot get stuck hidden.
export const MealPlanStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screenLayout: topInsetScreenLayout,
  screens: {
    MealPlanMain: createNativeStackScreen({
      screen: MealPlanMain,
      linking: 'meal-plan',
    }),
  },
});

export type MealPlanStackParams = StaticParamList<typeof MealPlanStack>;
