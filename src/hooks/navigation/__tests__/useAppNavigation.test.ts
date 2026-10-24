import { renderHook, act } from '@testing-library/react-native';
import { CommonActions } from '@react-navigation/native';
import { useAppNavigation } from '../useAppNavigation';

const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);
const mockNavigate = jest.fn();
const mockDispatch = jest.fn();
// The root stack: with `Auth` active, it is the screen the app starts on.
const mockRootState = jest.fn(() => ({
  routeNames: ['Auth', 'ResetPassword', 'NotFound'],
  routes: [{ name: 'ResetPassword' }],
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      goBack: mockGoBack,
      canGoBack: mockCanGoBack,
      navigate: mockNavigate,
      dispatch: mockDispatch,
      getParent: () => undefined,
      getState: mockRootState,
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
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    // A link that opened the app, or a session end that removed what was under
    // it, leaves the link's screen alone on the stack: its close still leaves.
    it('takes a deep-link screen alone on the stack to the screen the app starts on', () => {
      mockCanGoBack.mockReturnValue(false);
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.goBack();
      });

      expect(mockGoBack).not.toHaveBeenCalled();
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.reset({ index: 0, routes: [{ name: 'Auth' }] }),
      );
    });

    it('stays on the screen the app starts on, with nothing under it', () => {
      mockCanGoBack.mockReturnValue(false);
      mockRootState.mockReturnValueOnce({
        routeNames: ['Auth', 'ResetPassword', 'NotFound'],
        routes: [{ name: 'Auth' }],
      });
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.goBack();
      });

      expect(mockGoBack).not.toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
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
    // Popping back to the tabs, never a second `Home` over a modal.
    it('toPantryMain pops back to the Home > Pantry tab', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toPantryMain());
      expect(mockNavigate).toHaveBeenCalledWith(
        'Home',
        { screen: 'Pantry' },
        { pop: true },
      );
    });

    it('toShoppingListMain pops back to the Home > ShoppingList tab', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.toShoppingListMain());
      expect(mockNavigate).toHaveBeenCalledWith(
        'Home',
        { screen: 'ShoppingList' },
        { pop: true },
      );
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

    // `itemId` is required: the screen edits an existing item. It was optional
    // while the form carried an unreachable `add` mode, and an omitted id was
    // how you selected that mode.

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
        dataAttributions: [],
        nutritionFacts: {
          calories: 52,
          totalFat: 0.2,
          saturatedFat: null,
          transFat: null,
          cholesterol: null,
          sodium: 1,
          totalCarbs: 14,
          dietaryFiber: 2.4,
          totalSugars: 10,
          addedSugars: null,
          protein: 0.3,
          vitaminD: null,
          calcium: 6,
          iron: 0.1,
          potassium: 107,
          servingSize: 100,
          servingUnit: 'g',
        },
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

    // Neither the link nor a signed-out flow under it stays: one `Auth`, on Login.
    it('replaceWithLogin leaves the root holding only Auth > Login', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.replaceWithLogin());
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Auth', params: { screen: 'Login' } }],
        }),
      );
    });
  });

  it('exposes the raw navigation object as an escape hatch', () => {
    const { result } = renderHook(() => useAppNavigation());
    expect(result.current.navigation).toBeDefined();
    expect(result.current.navigation.navigate).toBe(mockNavigate);
  });
});
