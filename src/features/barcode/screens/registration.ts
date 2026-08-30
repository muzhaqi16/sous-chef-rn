import React from 'react';
import { createNativeStackScreen } from '@react-navigation/native-stack';
import { noInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';
import { SearchResultsScreen } from './SearchResultsScreen';

// Lazy-loaded to defer vision-camera's JS until the scanner is actually opened.
const BarcodeScannerScreen = React.lazy(() =>
  import('./BarcodeScannerScreen').then(m => ({
    default: m.BarcodeScannerScreen,
  })),
);

/**
 * The barcode feature's screens, spread into `BarcodeStack` (which keeps the
 * presentation decisions). Must stay a literal — react-navigation infers
 * per-screen param types only from a literal shape.
 */
export const barcodeScreens = {
  BarcodeScanner: createNativeStackScreen({
    screen: BarcodeScannerScreen,
    linking: 'scan',
    // Full-bleed camera that hides the status bar while focused, so it opts out
    // of the stack-wide top inset.
    layout: noInsetScreenLayout,
  }),
  SearchResults: createNativeStackScreen({
    screen: SearchResultsScreen,
    linking: 'scan/result',
  }),
};
