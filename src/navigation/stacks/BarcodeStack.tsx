import React from 'react';
import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { SearchResultsScreen } from '#features/barcode/screens/SearchResultsScreen';
import {
  topInsetScreenLayout,
  noInsetScreenLayout,
} from '#navigation/layouts/TopInsetLayout';

// Lazy-load camera-heavy screens to defer vision-camera JS loading
const BarcodeScannerScreen = React.lazy(() =>
  import('#features/barcode/screens/BarcodeScannerScreen').then(m => ({
    default: m.BarcodeScannerScreen,
  })),
);

export const BarcodeStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    presentation: 'modal',
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  // Screens use the default `inactiveBehavior: 'pause'`, so BarcodeScanner is
  // paused (and its camera resources released) once SearchResults is pushed on
  // top. Camera lifecycle is additionally managed inside the screens via
  // useFocusEffect → camera.unmountOnBlur for the blur/refocus case.
  // Top safe-area inset is the stack-wide default; the scanner opts out as a
  // full-bleed camera that hides the status bar (useHiddenStatusBar) while
  // focused.
  screenLayout: topInsetScreenLayout,
  screens: {
    BarcodeScanner: createNativeStackScreen({
      screen: BarcodeScannerScreen,
      linking: 'scan',
      layout: noInsetScreenLayout,
    }),
    SearchResults: createNativeStackScreen({
      screen: SearchResultsScreen,
      linking: 'scan/result',
    }),
  },
});

export type BarcodeStackParams = StaticParamList<typeof BarcodeStack>;
