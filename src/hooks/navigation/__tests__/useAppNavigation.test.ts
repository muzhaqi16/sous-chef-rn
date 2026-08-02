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
    it('toProfile navigates at root level', () => {
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

    // Two distinct ImageCrop routes: the root-level one used by the profile
    // photo flow, and Onboarding's own copy so cropping mid-onboarding stays
    // inside that flow.
    it('toImageCrop navigates to the root-level ImageCrop', () => {
      const { result } = renderHook(() => useAppNavigation());
      const imageFile = { uri: 'file://photo.jpg', fileName: 'photo.jpg' };

      act(() => result.current.toImageCrop({ imageFile }));

      expect(mockNavigate).toHaveBeenCalledWith('ImageCrop', { imageFile });
    });

    it('toOnboardingImageCrop navigates to Onboarding > ImageCrop', () => {
      const { result } = renderHook(() => useAppNavigation());
      const imageFile = { uri: 'file://photo.jpg', fileName: 'photo.jpg' };

      act(() => result.current.toOnboardingImageCrop({ imageFile }));

      expect(mockNavigate).toHaveBeenCalledWith('Onboarding', {
        screen: 'ImageCrop',
        params: { imageFile },
      });
    });
  });

  describe('nested-stack helpers', () => {
    it('toPantryMain focuses the Home > Pantry tab', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toPantryMain());
      expect(mockNavigate).toHaveBeenCalledWith('Home', { screen: 'Pantry' });
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

  // Every feature's detail screens are registered as siblings of `Home` via
  // their own `*Screens` group (e.g. features/pantry/screens/registration.ts),
  // so the facade dispatches a flat root-level navigate for all of them.
  describe('feature detail helpers', () => {
    it('toPantryItem navigates at root level with params', () => {
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

    it('toPantryItemDetail navigates at root level with itemId', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toPantryItemDetail({ itemId: 'item-1' }));
      expect(mockNavigate).toHaveBeenCalledWith('PantryItemDetail', {
        itemId: 'item-1',
      });
    });

    it('toNutritionScreen navigates at root level with full params', () => {
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

    it('toShoppingListItemDetail navigates at root level', () => {
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

    // A single root-level RecipeDetail serves all three tabs that open it, so
    // its own "open the fork I just made" / "edit this recipe" actions stay
    // wherever the user opened it from instead of jumping to a fixed tab.
    it('RecipeDetail and its edit action navigate at root level', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toRecipeDetail({ recipeId: 'r1' }));
      act(() => result.current.toRecipeEdit({ recipeId: 'r1' }));
      expect(mockNavigate).toHaveBeenNthCalledWith(1, 'RecipeDetail', {
        recipeId: 'r1',
      });
      expect(mockNavigate).toHaveBeenNthCalledWith(2, 'RecipeEdit', {
        recipeId: 'r1',
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
