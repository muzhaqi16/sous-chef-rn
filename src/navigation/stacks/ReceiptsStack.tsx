import type { StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { receiptScreens } from '#features/receipts/screens/registration';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

export const ReceiptsStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    presentation: 'modal',
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screenLayout: topInsetScreenLayout,
  screens: { ...receiptScreens },
});

export type ReceiptsStackParams = StaticParamList<typeof ReceiptsStack>;
