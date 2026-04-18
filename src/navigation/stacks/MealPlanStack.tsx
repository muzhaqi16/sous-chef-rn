import type { StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MealPlanMain } from '#features/mealPlan/screens/MealPlanMain';
import { CreateMealPlanScreen } from '#features/mealPlan/screens/CreateMealPlanScreen';
import { RecipeDetail } from '#features/recipes/screens/RecipeDetail';

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
