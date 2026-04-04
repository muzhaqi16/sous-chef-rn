import { renderHook, act } from '@testing-library/react-native';
import { CommonActions } from '@react-navigation/native';
import { useAppNavigation } from '../useAppNavigation';

const mockDispatch = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      dispatch: mockDispatch,
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
  describe('core navigation', () => {
    it('navigate dispatches CommonActions.navigate', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigate('Profile', { id: '1' });
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Profile', { id: '1' }),
      );
    });

    it('navigate works without params', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigate('Profile');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Profile', undefined),
      );
    });

    it('goBack calls navigation.goBack when canGoBack is true', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.goBack();
      });

      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });

    it('goBack does nothing when canGoBack is false', () => {
      mockCanGoBack.mockReturnValue(false);
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.goBack();
      });

      expect(mockGoBack).not.toHaveBeenCalled();
    });
  });

  describe('navigateTo shortcuts', () => {
    it('pantryMain navigates to Home > Pantry > PantryMain', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigateTo.pantryMain();
      });

      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'Pantry',
        params: { screen: 'PantryMain' },
      });
    });

    it('shoppingListMain navigates to Home > ShoppingList > ShoppingListMain', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => {
        result.current.navigateTo.shoppingListMain();
      });
      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'ShoppingList',
        params: { screen: 'ShoppingListMain' },
      });
    });

    it('notifications navigates to Notifications screen', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => {
        result.current.navigateTo.notifications();
      });
      expect(mockNavigate).toHaveBeenCalledWith('Notifications');
    });

    it('pantryItem navigates with optional params', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => {
        result.current.navigateTo.pantryItem({ itemId: 'p1' });
      });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('PantryItem', { itemId: 'p1' }),
      );
    });

    it('pantryItemDetail navigates with itemId', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigateTo.pantryItemDetail({ itemId: 'item-1' });
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('PantryItemDetail', { itemId: 'item-1' }),
      );
    });

    it('nutritionScreen navigates with full params', () => {
      const { result } = renderHook(() => useAppNavigation());
      const params = {
        itemId: 'i1',
        itemName: 'Apple',
        nutritions: [],
        actualServingGrams: 100,
      };
      act(() => {
        result.current.navigateTo.nutritionScreen(params);
      });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('NutritionScreen', params),
      );
    });

    it('barcode navigates to Barcode > BarcodeScanner with params', () => {
      const { result } = renderHook(() => useAppNavigation());
      const source: 'shoppingList' = 'shoppingList';
      const params = { source, shoppingListId: 'sl1' };
      act(() => {
        result.current.navigateTo.barcode(params);
      });
      expect(mockNavigate).toHaveBeenCalledWith('Barcode', {
        screen: 'BarcodeScanner',
        params,
      });
    });

    it('imageCrop navigates with imageFile params', () => {
      const { result } = renderHook(() => useAppNavigation());
      const imageFile = { uri: 'file://photo.jpg', fileName: 'photo.jpg' };

      act(() => {
        result.current.navigateTo.imageCrop({ imageFile });
      });

      expect(mockNavigate).toHaveBeenCalledWith('ImageCrop', { imageFile });
    });
  });

  it('exposes the raw navigation object', () => {
    const { result } = renderHook(() => useAppNavigation());
    expect(result.current.navigation).toBeDefined();
    expect(result.current.navigation.dispatch).toBe(mockDispatch);
  });
});
