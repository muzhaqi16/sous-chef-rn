import React from 'react';
import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { SearchResultsScreen } from '#screens/barcode/SearchResultsScreen';
import { IdentifiedItemFormScreen } from '#screens/barcode/IdentifiedItemFormScreen';

// Lazy-load camera-heavy screens to defer vision-camera JS loading
const BarcodeScannerScreen = React.lazy(() =>
  import('#screens/barcode/BarcodeScannerScreen').then(m => ({
    default: m.BarcodeScannerScreen,
  })),
);

const IdentifyItemScreen = React.lazy(() =>
  import('#screens/barcode/IdentifyItemScreen').then(m => ({
    default: m.IdentifyItemScreen,
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
    IdentifyItem: createNativeStackScreen({
      screen: IdentifyItemScreen,
      linking: 'identify',
    }),
    IdentifiedItemForm: createNativeStackScreen({
      screen: IdentifiedItemFormScreen,
      linking: 'identify/form',
    }),
  },
});

export type BarcodeStackParams = StaticParamList<typeof BarcodeStack>;
