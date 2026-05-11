import React from 'react';
import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { SearchResultsScreen } from '#features/barcode/screens/SearchResultsScreen';
import { IdentifiedItemFormScreen } from '#features/barcode/screens/IdentifiedItemFormScreen';

// Lazy-load camera-heavy screens to defer vision-camera JS loading
const BarcodeScannerScreen = React.lazy(() =>
  import('#features/barcode/screens/BarcodeScannerScreen').then(m => ({
    default: m.BarcodeScannerScreen,
  })),
);

const IdentifyItemScreen = React.lazy(() =>
  import('#features/barcode/screens/IdentifyItemScreen').then(m => ({
    default: m.IdentifyItemScreen,
  })),
);

export const BarcodeStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    presentation: 'modal',
    contentStyle: { backgroundColor: theme.colors.background },
    inactiveBehavior: 'none',
  }),
  // NOTE on screen freezing: vision-camera screens (BarcodeScanner,
  // IdentifyItem) would benefit from `inactiveBehavior: 'pause'` to release
  // camera/ML resources when blurred, but per-screen pause re-introduces the
  // Unistyles ShadowTree bug that the navigator-level `inactiveBehavior:
  // 'none'` was set to avoid. Camera lifecycle is instead managed inside the
  // screens via useFocusEffect → camera.unmountOnBlur.
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
