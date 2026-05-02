import React from 'react';
import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { SearchResultsScreen } from '#screens/barcode/SearchResultsScreen';

// Lazy-load BarcodeScannerScreen to defer vision-camera JS loading
const BarcodeScannerScreen = React.lazy(() =>
  import('#screens/barcode/BarcodeScannerScreen').then(m => ({
    default: m.BarcodeScannerScreen,
  })),
);

export const BarcodeStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    presentation: 'modal',
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screens: {
    BarcodeScanner: createNativeStackScreen({
      screen: BarcodeScannerScreen,
      linking: 'scan',
    }),
    SearchResults: createNativeStackScreen({
      screen: SearchResultsScreen,
      linking: 'scan/result',
    }),
  },
});

export type BarcodeStackParams = StaticParamList<typeof BarcodeStack>;
