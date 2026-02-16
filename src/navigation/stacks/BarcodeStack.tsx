import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { SearchResultsScreen } from '#screens/barcode/SearchResultsScreen';

// Lazy-load BarcodeScannerScreen to defer vision-camera JS loading
const BarcodeScannerScreen = React.lazy(
  () => import('#screens/barcode/BarcodeScannerScreen').then(m => ({ default: m.BarcodeScannerScreen })),
);

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
