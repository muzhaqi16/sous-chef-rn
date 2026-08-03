import { createNativeStackScreen } from '@react-navigation/native-stack';
import { cardScreenOptions } from '#navigation/detailScreenOptions';
import { HomeManagement } from './HomeManagement';
import { HomeDetailScreen } from './HomeDetailScreen';
import { StorageLocationsScreen } from './StorageLocationsScreen';

/**
 * Home (household) management screens, registered as siblings of `Home` the
 * tab navigator — see RootNavigator and `pantryDetailScreens` for the
 * rationale.
 *
 * These are reached from several places: `HomeManagement` from Profile, and
 * `HomeDetail` from both HomeManagement and the shopping list's
 * ListSettings/ShareList. One root-level registration serves all of them, so
 * `HomeDetail` needs no per-caller alias and its own "manage storage
 * locations" action resolves without ambiguity.
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
  StorageLocations: createNativeStackScreen({
    screen: StorageLocationsScreen,
    options: cardScreenOptions,
    linking: null,
  }),
};
