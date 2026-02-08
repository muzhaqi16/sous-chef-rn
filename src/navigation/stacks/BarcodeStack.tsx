import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { BarcodeScannerScreen } from '#screens/barcode/BarcodeScannerScreen';
import { SearchResultsScreen } from '#screens/barcode/SearchResultsScreen';

export const BarcodeStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    presentation: 'modal',
  },
  screens: {
    BarcodeScanner: {
      screen: BarcodeScannerScreen,
      linking: 'scan',
    },
    SearchResults: {
      screen: SearchResultsScreen,
      linking: 'scan/result',
    },
  },
});
