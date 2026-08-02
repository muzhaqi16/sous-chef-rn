import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { MealPlanMain } from '#features/mealPlan/screens/MealPlanMain';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

// Single-screen stack — see PantryStack for why detail screens live at the
// root instead (features/mealPlan/screens/registration.ts).
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
