import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  RecipeMain,
  RecipeDetail,
  RecipeSearch,
} from '#screens/recipe';

export type RecipeStackParamList = {
  RecipeMain: undefined;
  RecipeDetail: {
    recipeId?: string;         // Backend-saved recipe ID
    externalSource?: string;   // External source (SPOONACULAR, EDAMAM, TASTY, etc.)
    externalId?: string;       // External recipe ID
  };
  RecipeSearch: {ingredients?: string[]};
};

const Stack = createNativeStackNavigator<RecipeStackParamList>();

export const RecipeStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      animationDuration: 250,
      fullScreenGestureEnabled: true,
    }}
  >
    <Stack.Screen name="RecipeMain" component={RecipeMain} />
    <Stack.Screen name="RecipeDetail" component={RecipeDetail} />
    <Stack.Screen name="RecipeSearch" component={RecipeSearch} />
  </Stack.Navigator>
);
