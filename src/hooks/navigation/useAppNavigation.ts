import {useNavigation, useRoute, useIsFocused} from '@react-navigation/native';
import {useMemo} from 'react';
import NavigationService from '#services/NavigationService';

export const useAppNavigation = () => {
  const navigation = useNavigation(); // Automatically typed!
  const route = useRoute();
  const isFocused = useIsFocused();

  return useMemo(
    () => ({
      // Navigation methods
      navigate: NavigationService.navigate.bind(NavigationService),
      goBack: NavigationService.goBack.bind(NavigationService),
      push: NavigationService.push.bind(NavigationService),
      replace: NavigationService.replace.bind(NavigationService),
      popToTop: NavigationService.popToTop.bind(NavigationService),
      preload: NavigationService.preload.bind(NavigationService),

      // State
      currentRoute: route.name,
      params: route.params,
      isFocused,
      canGoBack: navigation.canGoBack(),

      // Quick navigation
      navigateToHome: () => navigation.navigate('HomeStack' as any),
      navigateToPantry: () => navigation.navigate('Main' as any),
      navigateToShoppingList: () => navigation.navigate('ShoppingList' as any),
      navigateToProfile: () => navigation.navigate('Profile' as any),
      navigateToNotifications: () =>
        navigation.navigate('NotificationStack' as any),
    }),
    [navigation, route, isFocused],
  );
};
