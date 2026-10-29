import { createNativeStackScreen } from '@react-navigation/native-stack';
import { cardScreenOptions } from '#navigation/detailScreenOptions';
import { StorageLocationsScreen } from './StorageLocationsScreen';
import { StorePickerScreen } from './StorePickerScreen';
import { UsualStoresScreen } from './UsualStoresScreen';

/**
 * Catalog screens, registered as siblings of the `Home` tab navigator (see
 * RootNavigator). `StorageLocations` and `UsualStores` are reached from
 * `HomeDetail`, and `StorePicker` from `UsualStores`, but owned here because
 * the entities are the catalog's.
 */
export const catalogScreens = {
  StorageLocations: createNativeStackScreen({
    screen: StorageLocationsScreen,
    options: cardScreenOptions,
    linking: null,
  }),
  UsualStores: createNativeStackScreen({
    screen: UsualStoresScreen,
    options: cardScreenOptions,
    linking: null,
  }),
  StorePicker: createNativeStackScreen({
    screen: StorePickerScreen,
    options: cardScreenOptions,
    linking: null,
  }),
};
