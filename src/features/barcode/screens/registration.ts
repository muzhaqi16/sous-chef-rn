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
 * The barcode feature's screens, composed into `BarcodeStack`.
 *
 * Declared here rather than inline in the stack so the feature owns its own
 * screen list, like every other feature does. The stack keeps the presentation
 * decisions (modal, insets, options) — those are navigation's, not the
 * feature's.
 *
 * A literal object, spread by the stack: react-navigation infers per-screen
 * param types only from a literal shape, and spreading one preserves that where
 * building the map dynamically would erase it.
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
