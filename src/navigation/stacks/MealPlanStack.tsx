import type { StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MealPlanMain } from '#screens/mealPlan/MealPlanMain';
import { CreateMealPlanScreen } from '#screens/mealPlan/CreateMealPlanScreen';
import { RecipeDetail } from '#screens/recipe/RecipeDetail';

export const MealPlanStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screens: {
    MealPlanMain: MealPlanMain,
    CreateMealPlan: CreateMealPlanScreen,
    RecipeDetail: RecipeDetail,
  },
});

export type MealPlanStackParams = StaticParamList<typeof MealPlanStack>;
