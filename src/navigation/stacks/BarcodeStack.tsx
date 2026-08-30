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
  // The default `inactiveBehavior: 'pause'` releases the scanner's camera once
  // SearchResults is pushed; the screens also handle blur/refocus through
  // `useFocusEffect` → `camera.unmountOnBlur`. The scanner opts out of the
  // stack-wide top inset as a full-bleed camera that hides the status bar.
  screenLayout: topInsetScreenLayout,
  screens: { ...barcodeScreens },
});

export type BarcodeStackParams = StaticParamList<typeof BarcodeStack>;
