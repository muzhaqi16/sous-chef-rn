import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { PantryMain } from '#screens/pantry/PantryMain';
import { PantryItemScreen } from '#screens/pantry/PantryItemScreen';
import { PantryItemDetail } from '#screens/pantry/PantryItemDetail';
import { LowStockItems } from '#screens/pantry/LowStockItems';
import { CategoryManagement } from '#screens/pantry/CategoryManagement';
import { PantrySettings } from '#screens/pantry/PantrySettings';
import { PantryAnalytics } from '#screens/pantry/PantryAnalytics';
import { NutritionScreen } from '#screens/pantry/NutritionScreen';
import { RecipeDetail } from '#screens/recipe/RecipeDetail';

export const PantryStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
  },
  screens: {
    PantryMain: {
      screen: PantryMain,
      linking: 'pantry',
    },
    PantryItem: {
      screen: PantryItemScreen,
      linking: 'pantry/item/:itemId?',
    },
    PantryItemDetail: {
      screen: PantryItemDetail,
      linking: 'pantry/detail/:itemId',
    },
    LowStockItems: LowStockItems,
    CategoryManagement: CategoryManagement,
    PantrySettings: PantrySettings,
    PantryAnalytics: PantryAnalytics,
    NutritionScreen: NutritionScreen,
    RecipeDetail: RecipeDetail,
  },
});
