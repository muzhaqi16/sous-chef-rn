import { createNativeStackScreen } from '@react-navigation/native-stack';
import { cardScreenOptions } from '#navigation/detailScreenOptions';
import { HomeManagement } from './HomeManagement';
import { HomeDetailScreen } from './HomeDetailScreen';

/**
 * Registered as siblings of the `Home` tab navigator, so one root-level entry
 * serves every caller and `HomeDetail` needs no per-caller alias. Its "manage
 * storage locations" action targets `StorageLocations` by ROUTE NAME, which the
 * catalog feature registers — so neither feature imports the other.
 */
export const homeManagementScreens = {
  HomeManagement: createNativeStackScreen({
    screen: HomeManagement,
    linking: 'home-management/:selectedHomeId?',
  }),
  HomeDetail: createNativeStackScreen({
    screen: HomeDetailScreen,
    options: cardScreenOptions,
    linking: null,
  }),
};
