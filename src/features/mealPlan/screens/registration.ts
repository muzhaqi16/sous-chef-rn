import { createNativeStackScreen } from '@react-navigation/native-stack';
import { detailScreenOptions } from '#navigation/detailScreenOptions';
import { CreateMealPlanScreen } from './CreateMealPlanScreen';
import { MealTemplateBuilderScreen } from './MealTemplateBuilderScreen';

/**
 * Meal plan's detail/sub screens, registered as siblings of `Home` — see
 * RootNavigator and `pantryDetailScreens` for the rationale. The recipe
 * screens this tab opens live in `recipeDetailScreens`.
 */
export const mealPlanDetailScreens = {
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
};
