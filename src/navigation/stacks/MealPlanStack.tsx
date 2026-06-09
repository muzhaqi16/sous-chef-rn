import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { MealPlanMain } from '#features/mealPlan/screens/MealPlanMain';
import { CreateMealPlanScreen } from '#features/mealPlan/screens/CreateMealPlanScreen';
import { RecipeDetail } from '#features/recipes/screens/RecipeDetail';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

export const MealPlanStack = createNativeStackNavigator({
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
    MealPlanMain: createNativeStackScreen({
      screen: MealPlanMain,
      linking: 'meal-plan',
      layout: topInsetScreenLayout,
    }),
    CreateMealPlan: createNativeStackScreen({
      screen: CreateMealPlanScreen,
      layout: topInsetScreenLayout,
    }),
    RecipeDetail: createNativeStackScreen({
      screen: RecipeDetail,
    }),
  },
});

export type MealPlanStackParams = StaticParamList<typeof MealPlanStack>;
