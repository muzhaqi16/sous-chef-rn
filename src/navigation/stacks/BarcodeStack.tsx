import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { BarcodeScannerScreen } from '#screens/barcode/BarcodeScannerScreen';
import { SearchResultsScreen } from '#screens/barcode/SearchResultsScreen';

export type BarcodeStackParamList = {
  BarcodeScanner:
    | {
        source?: 'pantry' | 'shoppingList';
        pantryId?: string;
        shoppingListId?: string;
      }
    | undefined;
  SearchResults: {
    barcode: string;
    format: string;
    source?: 'pantry' | 'shoppingList';
    pantryId?: string;
    shoppingListId?: string;
  };
};

const Stack = createNativeStackNavigator<BarcodeStackParamList>();

export const BarcodeStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      presentation: 'modal',
    }}>
    <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} />
    <Stack.Screen name="SearchResults" component={SearchResultsScreen} />
  </Stack.Navigator>
);
