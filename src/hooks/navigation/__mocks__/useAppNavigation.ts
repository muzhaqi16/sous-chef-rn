const mockNavigateTo = {
  pantryMain: jest.fn(),
  shoppingListMain: jest.fn(),
  notifications: jest.fn(),
  pantryItem: jest.fn(),
  pantryItemDetail: jest.fn(),
  nutritionScreen: jest.fn(),
  barcode: jest.fn(),
  imageCrop: jest.fn(),
};

// Stable mock instances — same jest.fn() across every useAppNavigation() call
// so tests can assert on them (e.g. expect(mockNav.goBack).toHaveBeenCalled()).
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  toVerifyEmail: jest.fn(),
  toShareList: jest.fn(),
  toStoreMode: jest.fn(),
  toListBudget: jest.fn(),
  toHomeDetail: jest.fn(),
  toHomeDietaryNeeds: jest.fn(),
  toUsualStores: jest.fn(),
  toStorePicker: jest.fn(),
  toBrandLists: jest.fn(),
  toBrandList: jest.fn(),
  toNutritionScreen: jest.fn(),
  toReceiptScan: jest.fn(),
  toBarcode: jest.fn(),
  navigation: {
    dispatch: jest.fn(),
    canGoBack: jest.fn(() => true),
    navigate: jest.fn(),
  },
  navigateTo: mockNavigateTo,
};

export const useAppNavigation = jest.fn(() => mockNavigation);
