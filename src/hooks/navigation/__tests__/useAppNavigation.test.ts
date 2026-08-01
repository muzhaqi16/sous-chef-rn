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
    it('toProfile navigates to Home > Pantry > Profile (nested)', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toProfile());
      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'Pantry',
        params: { screen: 'Profile', params: undefined },
      });
    });

    it('toNotifications navigates to Notifications > NotificationList', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toNotifications());
      expect(mockNavigate).toHaveBeenCalledWith('Notifications', {
        screen: 'NotificationList',
      });
    });

    it('toImageCrop navigates to Onboarding > ImageCrop with imageFile params', () => {
      const { result } = renderHook(() => useAppNavigation());
      const imageFile = { uri: 'file://photo.jpg', fileName: 'photo.jpg' };

      act(() => {
        result.current.toImageCrop({ imageFile });
      });

      expect(mockNavigate).toHaveBeenCalledWith('Onboarding', {
        screen: 'ImageCrop',
        params: { imageFile },
      });
    });

    it('toPantryImageCrop navigates to Home > Pantry > ImageCrop (nested)', () => {
      const { result } = renderHook(() => useAppNavigation());
      const imageFile = { uri: 'file://photo.jpg', fileName: 'photo.jpg' };

      act(() => {
        result.current.toPantryImageCrop({ imageFile });
      });

      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'Pantry',
        params: { screen: 'ImageCrop', params: { imageFile } },
      });
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

  // Pantry's detail/sub screens are nested under Pantry's own stack (see
  // PantryStack.tsx) so Pantry's Offscreen-pause boundary is isolated from
  // the other 3 tabs — the facade dispatches a nested Home > Pantry > X
  // navigate action for these. Other features' detail screens are still
  // root-level siblings of `Home` pending their own migration phases.
  describe('root-level feature detail helpers', () => {
    it('toPantryItem navigates nested to Home > Pantry > PantryItem', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toPantryItem({ itemId: 'p1' }));
      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'Pantry',
        params: { screen: 'PantryItem', params: { itemId: 'p1' } },
      });
    });

    it('toPantryItem defaults to empty params when omitted', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toPantryItem());
      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'Pantry',
        params: { screen: 'PantryItem', params: {} },
      });
    });

    it('toPantryItemDetail navigates nested with itemId', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toPantryItemDetail({ itemId: 'item-1' }));
      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'Pantry',
        params: {
          screen: 'PantryItemDetail',
          params: { itemId: 'item-1' },
        },
      });
    });

    it('toNutritionScreen navigates nested with full params', () => {
      const { result } = renderHook(() => useAppNavigation());
      const params = {
        itemId: 'i1',
        itemName: 'Apple',
        nutritions: [],
        actualServingGrams: 100,
      };
      act(() => result.current.toNutritionScreen(params));
      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'Pantry',
        params: { screen: 'NutritionScreen', params },
      });
    });

    it('toShoppingListItemDetail navigates nested to Home > ShoppingList > ItemDetail', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() =>
        result.current.toShoppingListItemDetail({
          listId: 'l1',
          itemId: 'i1',
        }),
      );
      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        screen: 'ShoppingList',
        params: {
          screen: 'ItemDetail',
          params: { listId: 'l1', itemId: 'i1' },
        },
      });
    });

    // Each of the three tabs that reach RecipeDetail (Pantry/Recipe/
    // MealPlan) has its own nested copy now — no shared root-level copy
    // left (see RootNavigator.tsx / MealPlanStack.tsx).
    it('the three RecipeDetail aliases each target their own nested copy', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toRecipeDetail({ recipeId: 'r1' }));
      act(() => result.current.toPantryRecipeDetail({ recipeId: 'r2' }));
      act(() => result.current.toMealPlanRecipeDetail({ recipeId: 'r3' }));
      expect(mockNavigate).toHaveBeenNthCalledWith(1, 'Home', {
        screen: 'Recipe',
        params: { screen: 'RecipeDetail', params: { recipeId: 'r1' } },
      });
      expect(mockNavigate).toHaveBeenNthCalledWith(2, 'Home', {
        screen: 'Pantry',
        params: { screen: 'RecipeDetail', params: { recipeId: 'r2' } },
      });
      expect(mockNavigate).toHaveBeenNthCalledWith(3, 'Home', {
        screen: 'MealPlan',
        params: { screen: 'RecipeDetail', params: { recipeId: 'r3' } },
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
