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
  toHomeDetail: jest.fn(),
  navigation: {
    dispatch: jest.fn(),
    canGoBack: jest.fn(() => true),
    navigate: jest.fn(),
  },
  navigateTo: mockNavigateTo,
};

export const useAppNavigation = jest.fn(() => mockNavigation);
