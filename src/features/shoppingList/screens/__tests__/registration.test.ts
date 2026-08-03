jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackScreen: <T>(config: T): T => config,
}));
jest.mock('../ListSettings', () => ({ ListSettings: () => null }));
jest.mock('../ShareList', () => ({ ShareList: () => null }));
jest.mock('../AddEditItem', () => ({ AddEditItem: () => null }));
jest.mock('../ItemDetail', () => ({ ShoppingListItemDetail: () => null }));
jest.mock('../PurchaseHistoryScreen', () => ({
  PurchaseHistoryScreen: () => null,
}));

import { expectDeclaresLinkingIntent } from '#/test-utils/screenRegistration';
import { shoppingListDetailScreens } from '../registration';

describe('shoppingListDetailScreens', () => {
  it('registers every shopping list detail screen', () => {
    expect(Object.keys(shoppingListDetailScreens).sort()).toEqual([
      'EditItem',
      'ItemDetail',
      'ListSettings',
      'PurchaseHistory',
      'ShareList',
    ]);
  });

  it('every screen declares an explicit linking intent', () => {
    expectDeclaresLinkingIntent(shoppingListDetailScreens);
  });
});
