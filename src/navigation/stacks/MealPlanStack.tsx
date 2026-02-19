import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { MealPlanMain } from '#screens/mealPlan/MealPlanMain';
import { CreateMealPlanScreen } from '#screens/mealPlan/CreateMealPlanScreen';

export const MealPlanStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
  },
  screens: {
    MealPlanMain: MealPlanMain,
    CreateMealPlan: CreateMealPlanScreen,
  },
});
