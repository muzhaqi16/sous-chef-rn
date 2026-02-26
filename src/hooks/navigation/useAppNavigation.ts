import {useNavigation, useRoute, StackActions, CommonActions} from '@react-navigation/native';
import {useMemo, useCallback} from 'react';

export function useAppNavigation() {
  const navigation = useNavigation();
  const route = useRoute();

  const navigate = useCallback(
    (name: string, params?: object) => {
      navigation.dispatch(CommonActions.navigate(name, params));
    },
    [navigation],
  );

  // Navigate to nested stack screens
  const navigateToNested = useCallback(
    (stackName: string, screenName: string, params?: object) => {
      navigation.dispatch(CommonActions.navigate(stackName, {
        screen: screenName,
        params,
      }));
    },
    [navigation],
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const replace = useCallback(
    (name: string, params?: object) => {
      navigation.dispatch(StackActions.replace(name, params));
    },
    [navigation],
  );

  const push = useCallback(
    (name: string, params?: object) => {
      navigation.dispatch(StackActions.push(name, params));
    },
    [navigation],
  );

  const popToTop = useCallback(() => {
    navigation.dispatch(StackActions.popToTop());
  }, [navigation]);

  // Feature-specific navigation shortcuts
  const navigateTo = useMemo(
    () => ({
      // Auth stack screens (when in Auth stack)
      login: () => navigate('Login'),
      signUp: () => navigate('SignUp'),
      forgotPassword: () => navigate('ForgotPassword'),
      codeVerification: (params?: { email?: string }) => navigate('CodeVerification', params),

      // Onboarding stack screens (when in Onboarding stack)
      createHome: () => navigate('CreateHome'),
      createShoppingList: () => navigate('CreateShoppingList'),
      selectPantryItems: () => navigate('SelectPantryItems'),
      profilePictureUpload: () => navigate('ProfilePictureUpload'),
      inviteMembers: () => navigate('InviteMembers'),
      onboardingComplete: () => navigate('OnboardingComplete'),

      // Main tab screens (nested navigation through HomeTabs)
      pantryMain: () =>
        navigate('Home', {
          screen: 'Pantry',
          params: {
            screen: 'PantryMain',
          },
        }),
      pantryItem: (params?: { itemId?: string }) => navigate('PantryItem', params),
      pantryItemDetail: (params: { itemId: string }) => navigate('PantryItemDetail', params),
      nutritionScreen: (params: {itemId: string; itemName: string; nutritions: unknown; actualServingGrams?: number}) =>
        navigate('NutritionScreen', params),
      shoppingListMain: () =>
        navigate('Home', {
          screen: 'ShoppingList',
          params: {
            screen: 'ShoppingListMain',
          },
        }),
      profile: () => navigate('Profile'),
      mealPlanMain: () =>
        navigate('Home', {
          screen: 'MealPlan',
          params: {
            screen: 'MealPlanMain',
          },
        }),
      createMealPlan: () =>
        navigate('Home', {
          screen: 'MealPlan',
          params: {
            screen: 'CreateMealPlan',
          },
        }),
      createRecipe: () =>
        navigate('Home', {
          screen: 'Recipe',
          params: {
            screen: 'RecipeCreate',
          },
        }),
      editRecipe: (params: { recipeId: string }) =>
        navigate('Home', {
          screen: 'Recipe',
          params: {
            screen: 'RecipeEdit',
            params,
          },
        }),

      // Root level screens
      homeManagement: (params?: { homeId?: string }) => navigate('HomeManagement', params),
      imageUpload: () => navigate('ProfilePhotoUpload'),
      imageCrop: (params: { imageFile: { uri: string; fileName?: string; fileSize?: number; type?: string } }) => navigate('ImageCrop', params),

      // Nested stack navigation (Notifications)
      notificationList: () =>
        navigateToNested('Notifications', 'NotificationList'),
      notificationDetail: (notification: { id: string; title: string; body: string; [key: string]: unknown }) =>
        navigateToNested('Notifications', 'NotificationDetail', {notification}),
      notificationSettings: () =>
        navigateToNested('Notifications', 'NotificationSettings'),

      // Nested stack navigation (Barcode)
      barcodeScanner: (params?: { source?: 'pantry' | 'shoppingList'; pantryId?: string; shoppingListId?: string }) =>
        navigateToNested('Barcode', 'BarcodeScanner', params),
      searchResults: (params: { barcode: string; format: string; source?: 'pantry' | 'shoppingList'; pantryId?: string; shoppingListId?: string }) =>
        navigateToNested('Barcode', 'SearchResults', params),

      // Alternative: Direct navigation to root stacks
      notifications: () => navigate('Notifications'),
      barcode: (params?: { source?: 'pantry' | 'shoppingList'; pantryId?: string; shoppingListId?: string }) => navigate('Barcode', {
        screen: 'BarcodeScanner',
        params: params,
      }),
    }),
    [navigate, navigateToNested],
  );

  return {
    // Navigation state
    currentRoute: route.name,
    params: route.params,
    canGoBack: navigation.canGoBack(),

    // Core navigation
    navigate,
    navigateToNested,
    goBack,
    replace,
    push,
    popToTop,

    // Raw navigation object (for advanced use cases like parent navigation)
    navigation,

    // Feature navigation
    navigateTo,
  };
}
