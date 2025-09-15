import {useNavigation, useRoute, useIsFocused} from '@react-navigation/native';
import {useMemo, useCallback} from 'react';
import {StackActions} from '@react-navigation/native';

export function useAppNavigation() {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();

  // Core navigation methods
  const navigate = useCallback(
    (name: string, params?: any) => {
      navigation.navigate(name as any, params);
    },
    [navigation],
  );

  // Navigate to nested stack screens
  const navigateToNested = useCallback(
    (stackName: string, screenName: string, params?: any) => {
      navigation.navigate(stackName as any, {
        screen: screenName,
        params: params,
      });
    },
    [navigation],
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const replace = useCallback(
    (name: string, params?: any) => {
      navigation.dispatch(StackActions.replace(name, params));
    },
    [navigation],
  );

  const push = useCallback(
    (name: string, params?: any) => {
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
      codeVerification: (params?: any) => navigate('CodeVerification', params),

      // Onboarding stack screens (when in Onboarding stack)
      createHome: () => navigate('CreateHome'),
      createShoppingList: () => navigate('CreateShoppingList'),
      selectPantryItems: () => navigate('SelectPantryItems'),
      profilePictureUpload: () => navigate('ProfilePictureUpload'),
      inviteMembers: () => navigate('InviteMembers'),
      onboardingComplete: () => navigate('OnboardingComplete'),

      // Main tab screens (direct navigation to tabs)
      pantryMain: () => navigate('PantryMain'),
      pantryItem: (params: any) => navigate('PantryItem', params),
      pantryItemDetail: (params: any) => navigate('PantryItemDetail', params),
      shoppingListMain: () => navigate('ShoppingListMain'),
      profile: () => navigate('Profile'),

      // Root level screens
      homeManagement: (params?: any) => navigate('HomeManagement', params),
      imageUpload: () => navigate('ProfilePhotoUpload'),
      imageCrop: (params: any) => navigate('ImageCrop', params),

      // Nested stack navigation (Notifications)
      notificationList: () =>
        navigateToNested('Notifications', 'NotificationList'),
      notificationDetail: (notification: any) =>
        navigateToNested('Notifications', 'NotificationDetail', {notification}),
      notificationSettings: () =>
        navigateToNested('Notifications', 'NotificationSettings'),

      // Nested stack navigation (Barcode)
      barcodeScanner: (params?: any) =>
        navigateToNested('Barcode', 'BarcodeScanner', params),
      searchResults: (params: any) =>
        navigateToNested('Barcode', 'SearchResults', params),

      // Alternative: Direct navigation to root stacks
      notifications: () => navigate('Notifications'),
      barcode: (params?: any) => navigate('Barcode', params),
    }),
    [navigate, navigateToNested],
  );

  return {
    // Navigation state
    currentRoute: route.name,
    params: route.params,
    isFocused,
    canGoBack: navigation.canGoBack(),

    // Core navigation
    navigate,
    navigateToNested,
    goBack,
    replace,
    push,
    popToTop,

    // Feature navigation
    navigateTo,
  };
}
