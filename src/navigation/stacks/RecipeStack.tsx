import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { RecipeMain } from '#screens/recipe/RecipeMain';
import { RecipeDetail } from '#screens/recipe/RecipeDetail';
import { RecipeSearch } from '#screens/recipe/RecipeSearch';
import { RecipeFormScreen } from '#screens/recipe/RecipeForm';

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
    RecipeSearch: RecipeSearch,
    RecipeCreate: RecipeFormScreen,
    RecipeEdit: RecipeFormScreen,
  },
});
