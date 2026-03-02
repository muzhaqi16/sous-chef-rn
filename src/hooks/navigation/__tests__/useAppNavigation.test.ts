import { renderHook, act } from '@testing-library/react-native';
import { CommonActions, StackActions } from '@react-navigation/native';
import { useAppNavigation } from '../useAppNavigation';

const mockDispatch = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      dispatch: mockDispatch,
      goBack: mockGoBack,
      canGoBack: mockCanGoBack,
    }),
    useRoute: () => ({
      name: 'TestScreen',
      params: { testParam: 'value' },
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
});

describe('useAppNavigation', () => {
  describe('navigation state', () => {
    it('returns current route name', () => {
      const { result } = renderHook(() => useAppNavigation());
      expect(result.current.currentRoute).toBe('TestScreen');
    });

    it('returns route params', () => {
      const { result } = renderHook(() => useAppNavigation());
      expect(result.current.params).toEqual({ testParam: 'value' });
    });

    it('returns canGoBack from navigation', () => {
      const { result } = renderHook(() => useAppNavigation());
      expect(result.current.canGoBack).toBe(true);
    });

    it('returns canGoBack false when navigation says so', () => {
      mockCanGoBack.mockReturnValue(false);
      const { result } = renderHook(() => useAppNavigation());
      expect(result.current.canGoBack).toBe(false);
    });
  });

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

    it('navigateToNested dispatches CommonActions.navigate with screen param', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigateToNested('Notifications', 'NotificationList');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Notifications', {
          screen: 'NotificationList',
          params: undefined,
        }),
      );
    });

    it('navigateToNested passes params to nested screen', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigateToNested('Notifications', 'NotificationDetail', {
          id: 'n1',
        });
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Notifications', {
          screen: 'NotificationDetail',
          params: { id: 'n1' },
        }),
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

    it('replace dispatches StackActions.replace', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.replace('Home', { tab: 'pantry' });
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        StackActions.replace('Home', { tab: 'pantry' }),
      );
    });

    it('push dispatches StackActions.push', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.push('PantryItem', { itemId: '1' });
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        StackActions.push('PantryItem', { itemId: '1' }),
      );
    });

    it('popToTop dispatches StackActions.popToTop', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.popToTop();
      });

      expect(mockDispatch).toHaveBeenCalledWith(StackActions.popToTop());
    });
  });

  describe('navigateTo shortcuts', () => {
    it('login navigates to Login screen', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigateTo.login();
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Login', undefined),
      );
    });

    it('signUp navigates to SignUp screen', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigateTo.signUp();
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('SignUp', undefined),
      );
    });

    it('forgotPassword navigates to ForgotPassword screen', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigateTo.forgotPassword();
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('ForgotPassword', undefined),
      );
    });

    it('codeVerification navigates with optional params', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigateTo.codeVerification({ email: 'a@b.com' });
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('CodeVerification', { email: 'a@b.com' }),
      );
    });

    it('pantryMain navigates to Home > Pantry > PantryMain', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigateTo.pantryMain();
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Home', {
          screen: 'Pantry',
          params: { screen: 'PantryMain' },
        }),
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

    it('notificationList navigates to nested Notifications > NotificationList', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigateTo.notificationList();
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Notifications', {
          screen: 'NotificationList',
          params: undefined,
        }),
      );
    });

    it('barcodeScanner navigates to nested Barcode > BarcodeScanner', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigateTo.barcodeScanner({ source: 'pantry' });
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Barcode', {
          screen: 'BarcodeScanner',
          params: { source: 'pantry' },
        }),
      );
    });

    it('createRecipe navigates to Home > Recipe > RecipeCreate', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigateTo.createRecipe();
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Home', {
          screen: 'Recipe',
          params: { screen: 'RecipeCreate' },
        }),
      );
    });

    it('editRecipe navigates to Home > Recipe > RecipeEdit with recipeId', () => {
      const { result } = renderHook(() => useAppNavigation());

      act(() => {
        result.current.navigateTo.editRecipe({ recipeId: 'r1' });
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Home', {
          screen: 'Recipe',
          params: { screen: 'RecipeEdit', params: { recipeId: 'r1' } },
        }),
      );
    });

    it('imageCrop navigates with imageFile params', () => {
      const { result } = renderHook(() => useAppNavigation());
      const imageFile = { uri: 'file://photo.jpg', fileName: 'photo.jpg' };

      act(() => {
        result.current.navigateTo.imageCrop({ imageFile });
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('ImageCrop', { imageFile }),
      );
    });
  });

  it('exposes the raw navigation object', () => {
    const { result } = renderHook(() => useAppNavigation());
    expect(result.current.navigation).toBeDefined();
    expect(result.current.navigation.dispatch).toBe(mockDispatch);
  });

  describe('additional navigateTo shortcuts', () => {
    it('createHome navigates to CreateHome', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.createHome(); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('CreateHome', undefined),
      );
    });

    it('createShoppingList navigates to CreateShoppingList', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.createShoppingList(); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('CreateShoppingList', undefined),
      );
    });

    it('selectPantryItems navigates to SelectPantryItems', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.selectPantryItems(); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('SelectPantryItems', undefined),
      );
    });

    it('profilePictureUpload navigates to ProfilePictureUpload', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.profilePictureUpload(); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('ProfilePictureUpload', undefined),
      );
    });

    it('inviteMembers navigates to InviteMembers', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.inviteMembers(); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('InviteMembers', undefined),
      );
    });

    it('onboardingComplete navigates to OnboardingComplete', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.onboardingComplete(); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('OnboardingComplete', undefined),
      );
    });

    it('pantryItem navigates with optional params', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.pantryItem({ itemId: 'p1' }); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('PantryItem', { itemId: 'p1' }),
      );
    });

    it('nutritionScreen navigates with full params', () => {
      const { result } = renderHook(() => useAppNavigation());
      const params = { itemId: 'i1', itemName: 'Apple', nutritions: [], actualServingGrams: 100 };
      act(() => { result.current.navigateTo.nutritionScreen(params); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('NutritionScreen', params),
      );
    });

    it('shoppingListMain navigates to Home > ShoppingList > ShoppingListMain', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.shoppingListMain(); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Home', {
          screen: 'ShoppingList',
          params: { screen: 'ShoppingListMain' },
        }),
      );
    });

    it('profile navigates to Profile screen', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.profile(); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Profile', undefined),
      );
    });

    it('mealPlanMain navigates to Home > MealPlan > MealPlanMain', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.mealPlanMain(); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Home', {
          screen: 'MealPlan',
          params: { screen: 'MealPlanMain' },
        }),
      );
    });

    it('createMealPlan navigates to Home > MealPlan > CreateMealPlan', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.createMealPlan(); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Home', {
          screen: 'MealPlan',
          params: { screen: 'CreateMealPlan' },
        }),
      );
    });

    it('homeManagement navigates with optional homeId', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.homeManagement({ homeId: 'h1' }); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('HomeManagement', { homeId: 'h1' }),
      );
    });

    it('imageUpload navigates to ProfilePhotoUpload', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.imageUpload(); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('ProfilePhotoUpload', undefined),
      );
    });

    it('notificationDetail navigates with notification params', () => {
      const { result } = renderHook(() => useAppNavigation());
      const notification = { id: 'n1', title: 'Test', body: 'Body' };
      act(() => { result.current.navigateTo.notificationDetail(notification); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Notifications', {
          screen: 'NotificationDetail',
          params: { notification },
        }),
      );
    });

    it('notificationSettings navigates to nested NotificationSettings', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.notificationSettings(); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Notifications', {
          screen: 'NotificationSettings',
          params: undefined,
        }),
      );
    });

    it('searchResults navigates to nested Barcode > SearchResults', () => {
      const { result } = renderHook(() => useAppNavigation());
      const params = { barcode: '12345', format: 'EAN13', source: 'pantry' as const };
      act(() => { result.current.navigateTo.searchResults(params); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Barcode', {
          screen: 'SearchResults',
          params,
        }),
      );
    });

    it('notifications navigates to root Notifications', () => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => { result.current.navigateTo.notifications(); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Notifications', undefined),
      );
    });

    it('barcode navigates to root Barcode with source params', () => {
      const { result } = renderHook(() => useAppNavigation());
      const params = { source: 'shoppingList' as const, shoppingListId: 'sl1' };
      act(() => { result.current.navigateTo.barcode(params); });
      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Barcode', {
          screen: 'BarcodeScanner',
          params,
        }),
      );
    });
  });
});
