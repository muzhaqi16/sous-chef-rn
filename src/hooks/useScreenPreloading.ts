import {useEffect} from 'react';
import {CommonActions} from '@react-navigation/native';
import {navigationRef} from '#services/NavigationService';

export const useScreenPreloading = () => {
  useEffect(() => {
    // Preload heavy screens when the app is idle
    const timer = setTimeout(() => {
      if (navigationRef.isReady()) {
        // Preload screens that are likely to be visited
        navigationRef.dispatch(CommonActions.preload('ShoppingListMain'));
        navigationRef.dispatch(CommonActions.preload('PantryMain'));
        navigationRef.dispatch(CommonActions.preload('NotificationList'));
      }
    }, 2000); // Wait 2 seconds after mount

    return () => clearTimeout(timer);
  }, []);
};
