import type { StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { barcodeScreens } from '#features/barcode/screens/registration';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

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
  screens: { ...barcodeScreens },
});

export type BarcodeStackParams = StaticParamList<typeof BarcodeStack>;
