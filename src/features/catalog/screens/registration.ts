import { createNativeStackScreen } from '@react-navigation/native-stack';
import { cardScreenOptions } from '#navigation/detailScreenOptions';
import { StorageLocationsScreen } from './StorageLocationsScreen';

/**
 * Catalog screens, registered as siblings of `Home` the tab navigator — see
 * RootNavigator and `pantryDetailScreens` for the rationale.
 *
 * `StorageLocations` is reached from `HomeDetail`'s "manage storage locations"
 * action. It is registered here rather than by `home` because the entity is
 * the catalog's: `pantry` reads storage locations too, and neither consumer
 * should own the other's screen.
 */
export const catalogScreens = {
  StorageLocations: createNativeStackScreen({
    screen: StorageLocationsScreen,
    options: cardScreenOptions,
    linking: null,
  }),
};
