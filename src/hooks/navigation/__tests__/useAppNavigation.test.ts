import { renderHook, act } from '@testing-library/react-native';
import { useAppNavigation } from '../useAppNavigation';

const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      goBack: mockGoBack,
      canGoBack: mockCanGoBack,
      navigate: mockNavigate,
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
});

describe('useAppNavigation', () => {
  describe('goBack', () => {
    it('calls navigation.goBack when canGoBack is true', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.goBack();
      });

      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });

    it('does nothing when canGoBack is false', () => {
      mockCanGoBack.mockReturnValue(false);
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.goBack();
      });

      expect(mockGoBack).not.toHaveBeenCalled();
    });
  });

  describe('root-level screen helpers', () => {
    it('toProfile navigates to Profile', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toProfile());
      expect(mockNavigate).toHaveBeenCalledWith('Profile');
    });

    it('toNotifications navigates to Notifications > NotificationList', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toNotifications());
      expect(mockNavigate).toHaveBeenCalledWith('Notifications', {
        screen: 'NotificationList',
      });
    });

    it('toImageCrop navigates with imageFile params', () => {
      const { result } = renderHook(() => useAppNavigation());
      const imageFile = { uri: 'file://photo.jpg', fileName: 'photo.jpg' };

      act(() => {
        result.current.toImageCrop({ imageFile });
      });

      expect(mockNavigate).toHaveBeenCalledWith('ImageCrop', { imageFile });
    });
  });

  describe('nested-stack helpers', () => {
    it('toPantryMain focuses the Home > Pantry tab', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toPantryMain());
      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'Pantry',
      });
    });

    it('toShoppingListMain focuses the Home > ShoppingList tab', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toShoppingListMain());
      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'ShoppingList',
      });
    });

    it('toBarcode navigates Barcode > BarcodeScanner with params', () => {
      const { result } = renderHook(() => useAppNavigation());
      const source: 'shoppingList' = 'shoppingList';
      const params = { source, shoppingListId: 'sl1' };
      act(() => result.current.toBarcode(params));
      expect(mockNavigate).toHaveBeenCalledWith('Barcode', {
        screen: 'BarcodeScanner',
        params,
      });
    });
  });

  // Feature detail/sub screens live at the root level (siblings of the tab
  // navigator), so the facade navigates to them directly — not nested under
  // `Home`. This keeps the floating tab bar off them entirely.
  describe('root-level feature detail helpers', () => {
    it('toPantryItem navigates directly to PantryItem', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toPantryItem({ itemId: 'p1' }));
      expect(mockNavigate).toHaveBeenCalledWith('PantryItem', {
        itemId: 'p1',
      });
    });

    it('toPantryItem defaults to empty params when omitted', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toPantryItem());
      expect(mockNavigate).toHaveBeenCalledWith('PantryItem', {});
    });

    it('toPantryItemDetail navigates directly with itemId', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toPantryItemDetail({ itemId: 'item-1' }));
      expect(mockNavigate).toHaveBeenCalledWith('PantryItemDetail', {
        itemId: 'item-1',
      });
    });

    it('toNutritionScreen navigates directly with full params', () => {
      const { result } = renderHook(() => useAppNavigation());
      const params = {
        itemId: 'i1',
        itemName: 'Apple',
        nutritions: [],
        actualServingGrams: 100,
      };
      act(() => result.current.toNutritionScreen(params));
      expect(mockNavigate).toHaveBeenCalledWith('NutritionScreen', params);
    });

    it('toShoppingListItemDetail navigates directly to ItemDetail', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() =>
        result.current.toShoppingListItemDetail({
          listId: 'l1',
          itemId: 'i1',
        }),
      );
      expect(mockNavigate).toHaveBeenCalledWith('ItemDetail', {
        listId: 'l1',
        itemId: 'i1',
      });
    });

    it('all three RecipeDetail aliases target the single root RecipeDetail', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toRecipeDetail({ recipeId: 'r1' }));
      act(() => result.current.toPantryRecipeDetail({ recipeId: 'r2' }));
      act(() => result.current.toMealPlanRecipeDetail({ recipeId: 'r3' }));
      expect(mockNavigate).toHaveBeenNthCalledWith(1, 'RecipeDetail', {
        recipeId: 'r1',
      });
      expect(mockNavigate).toHaveBeenNthCalledWith(2, 'RecipeDetail', {
        recipeId: 'r2',
      });
      expect(mockNavigate).toHaveBeenNthCalledWith(3, 'RecipeDetail', {
        recipeId: 'r3',
      });
    });
  });

  describe('auth helpers', () => {
    it('toLogin navigates Auth > Login', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toLogin());
      expect(mockNavigate).toHaveBeenCalledWith('Auth', { screen: 'Login' });
    });

    it('toEmailVerification passes token at root level', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toEmailVerification('tok123'));
      expect(mockNavigate).toHaveBeenCalledWith('EmailVerification', {
        token: 'tok123',
      });
    });
  });

  it('exposes the raw navigation object as an escape hatch', () => {
    const { result } = renderHook(() => useAppNavigation());
    expect(result.current.navigation).toBeDefined();
    expect(result.current.navigation.navigate).toBe(mockNavigate);
  });
});
