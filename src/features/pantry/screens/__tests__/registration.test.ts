// `createNativeStackScreen` is an identity helper over the config object, so
// each entry can be inspected directly as its raw `{ screen, options, linking }`.
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackScreen: <T>(config: T): T => config,
}));

// The screen modules themselves are irrelevant here — this asserts the shape
// of the registration config, not the screens. Mocking them keeps the suite
// off the heavy real modules (bottom-sheet scrollables, Skia, victory-native).
jest.mock('../PantryItemScreen', () => ({ PantryItemScreen: () => null }));
jest.mock('../PantryItemDetail', () => ({ PantryItemDetail: () => null }));
jest.mock('../FilteredPantryItems', () => ({
  FilteredPantryItems: () => null,
}));
jest.mock('../PantrySettings', () => ({ PantrySettings: () => null }));
jest.mock('../NutritionScreen', () => ({ NutritionScreen: () => null }));

import { expectDeclaresLinkingIntent } from '#/test-utils/screenRegistration';
import { pantryDetailScreens } from '../registration';

describe('pantryDetailScreens', () => {
  it('registers every pantry detail screen', () => {
    expect(Object.keys(pantryDetailScreens).sort()).toEqual([
      'FilteredPantryItems',
      'NutritionScreen',
      'PantryAnalytics',
      'PantryBatchHistory',
      'PantryItem',
      'PantryItemDetail',
      'PantrySettings',
      'PantryUsageHistory',
    ]);
  });

  it('every screen declares an explicit linking intent', () => {
    expectDeclaresLinkingIntent(pantryDetailScreens);
  });
});
