import React from 'react';
import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { SearchResultsScreen } from '#features/barcode/screens/SearchResultsScreen';

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
    inactiveBehavior: 'none',
  }),
  // NOTE on screen freezing: BarcodeScanner would benefit from
  // `inactiveBehavior: 'pause'` to release camera resources when blurred,
  // but per-screen pause re-introduces the Unistyles ShadowTree bug that
  // the navigator-level `inactiveBehavior: 'none'` was set to avoid.
  // Camera lifecycle is instead managed inside the screens via
  // useFocusEffect → camera.unmountOnBlur.
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
