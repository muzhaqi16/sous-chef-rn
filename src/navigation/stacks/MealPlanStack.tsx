import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { MealPlanMain } from '#features/mealPlan/screens/MealPlanMain';
import { CreateMealPlanScreen } from '#features/mealPlan/screens/CreateMealPlanScreen';
import { RecipeDetail } from '#features/recipes/screens/RecipeDetail';
import {
  topInsetScreenLayout,
  noInsetScreenLayout,
} from '#navigation/layouts/TopInsetLayout';

export const MealPlanStack = createNativeStackNavigator({
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
    MealPlanMain: createNativeStackScreen({
      screen: MealPlanMain,
      linking: 'meal-plan',
    }),
    CreateMealPlan: createNativeStackScreen({
      screen: CreateMealPlanScreen,
    }),
    RecipeDetail: createNativeStackScreen({
      screen: RecipeDetail,
      layout: noInsetScreenLayout,
    }),
  },
});

export type MealPlanStackParams = StaticParamList<typeof MealPlanStack>;
