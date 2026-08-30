import { createNativeStackScreen } from '@react-navigation/native-stack';
import { cardScreenOptions } from '#navigation/detailScreenOptions';
import { StorageLocationsScreen } from './StorageLocationsScreen';

/**
 * Catalog screens, registered as siblings of the `Home` tab navigator (see
 * RootNavigator). `StorageLocations` is reached from `HomeDetail` but owned
 * here because the entity is the catalog's — `pantry` reads it too.
 */
export const catalogScreens = {
  StorageLocations: createNativeStackScreen({
    screen: StorageLocationsScreen,
    options: cardScreenOptions,
    linking: null,
  }),
};
