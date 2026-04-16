import { useNavigation, CommonActions } from '@react-navigation/native';
import type { RootStackParamList } from '#navigation/RootNavigator';
import type { PantryStackParams } from '#navigation/stacks/PantryStack';
import type { BarcodeStackParams } from '#navigation/stacks/BarcodeStack';

export function useAppNavigation() {
  const navigation = useNavigation();

  /**
   * Navigate to any screen in the navigator tree via CommonActions (tree search).
   * For full type safety, prefer the navigateTo shortcuts below.
   */
  const navigate = (name: string, params?: object) => {
    navigation.dispatch(CommonActions.navigate(name, params));
  };

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  // Typed navigation shortcuts organized by domain.
  // These use navigation.navigate() with nested params — fully typed by v8's
  // RootNavigator augmentation. No manual param lists needed.
  const navigateTo = {
    // Cross-tab (nested nav structure, fully typed by v8)
    pantryMain: () =>
      navigation.navigate('Home', {
        screen: 'Pantry',
        params: { screen: 'PantryMain' },
      }),
    shoppingListMain: () =>
      navigation.navigate('Home', {
        screen: 'ShoppingList',
        params: { screen: 'ShoppingListMain' },
      }),
    notifications: () => navigation.navigate('Notifications'),

    // Pantry screens (typed via PantryStackParams)
    pantryItem: (params?: PantryStackParams['PantryItem']) =>
      navigate('PantryItem', params),
    pantryItemDetail: (params: PantryStackParams['PantryItemDetail']) =>
      navigate('PantryItemDetail', params),
    nutritionScreen: (params: PantryStackParams['NutritionScreen']) =>
      navigate('NutritionScreen', params),

    // Barcode modal (nested into BarcodeStack, fully typed by v8)
    barcode: (params?: BarcodeStackParams['BarcodeScanner']) =>
      navigation.navigate('Barcode', {
        screen: 'BarcodeScanner',
        params,
      }),

    // Identify-item modal (OCR-based item entry, shares BarcodeStack)
    identifyItem: (params?: BarcodeStackParams['IdentifyItem']) =>
      navigation.navigate('Barcode', {
        screen: 'IdentifyItem',
        params,
      }),
    identifiedItemForm: (params: BarcodeStackParams['IdentifiedItemForm']) =>
      navigation.navigate('Barcode', {
        screen: 'IdentifiedItemForm',
        params,
      }),

    // Media (root-level screen, fully typed by v8)
    imageCrop: (params: RootStackParamList['ImageCrop']) =>
      navigation.navigate('ImageCrop', params),
  };

  return {
    navigate,
    goBack,
    navigation,
    navigateTo,
  };
}
