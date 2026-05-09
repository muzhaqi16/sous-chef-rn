import type { StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RecipeMain } from '#features/recipes/screens/RecipeMain';
import { RecipeDetail } from '#features/recipes/screens/RecipeDetail';
import { RecipeFormScreen } from '#features/recipes/screens/RecipeForm';
import { SavedRecipes } from '#features/recipes/screens/SavedRecipes';
import { MyRecipes } from '#features/recipes/screens/MyRecipes';

export const RecipeStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
    inactiveBehavior: 'none',
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
