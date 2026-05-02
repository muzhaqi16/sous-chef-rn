import type { StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RecipeMain } from '#screens/recipe/RecipeMain';
import { RecipeDetail } from '#screens/recipe/RecipeDetail';
import { RecipeFormScreen } from '#screens/recipe/RecipeForm';
import { SavedRecipes } from '#screens/recipe/SavedRecipes';
import { MyRecipes } from '#screens/recipe/MyRecipes';

export const RecipeStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screens: {
    RecipeMain: RecipeMain,
    RecipeDetail: RecipeDetail,
    RecipeCreate: RecipeFormScreen,
    RecipeEdit: RecipeFormScreen,
    SavedRecipes: SavedRecipes,
    MyRecipes: MyRecipes,
  },
});

export type RecipeStackParams = StaticParamList<typeof RecipeStack>;
