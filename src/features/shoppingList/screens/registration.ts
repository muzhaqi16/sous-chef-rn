import { createNativeStackScreen } from '@react-navigation/native-stack';
import { noInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';
import { detailScreenOptions } from '#navigation/detailScreenOptions';
import { ListSettings } from './ListSettings';
import { ShareList } from './ShareList';
import { AddEditItem } from './AddEditItem';
import { ShoppingListItemDetail } from './ItemDetail';
import { PurchaseHistoryScreen } from './PurchaseHistoryScreen';

/**
 * Shopping list's detail/sub screens, registered as siblings of `Home` — see
 * RootNavigator and `pantryDetailScreens` for the rationale.
 */
export const shoppingListDetailScreens = {
  ListSettings: createNativeStackScreen({
    screen: ListSettings,
    options: detailScreenOptions,
    linking: null,
  }),
  ShareList: createNativeStackScreen({
    screen: ShareList,
    options: detailScreenOptions,
    linking: null,
  }),
  EditItem: createNativeStackScreen({
    screen: AddEditItem,
    options: detailScreenOptions,
    linking: null,
  }),
  ItemDetail: createNativeStackScreen({
    screen: ShoppingListItemDetail,
    // Hero screen — draws edge-to-edge, so it opts out of the top inset.
    layout: noInsetScreenLayout,
    options: detailScreenOptions,
    linking: null,
  }),
  PurchaseHistory: createNativeStackScreen({
    screen: PurchaseHistoryScreen,
    options: detailScreenOptions,
    linking: null,
  }),
};
