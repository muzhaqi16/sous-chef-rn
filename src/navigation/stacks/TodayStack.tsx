import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { TodayMain } from '#features/today/screens/TodayMain';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

// Single-screen stack: every screen Today opens belongs to another tab or is a
// sibling of `Home`, so nothing is pushed here.
export const TodayStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screenLayout: topInsetScreenLayout,
  screens: {
    TodayMain: createNativeStackScreen({
      screen: TodayMain,
      linking: 'today',
    }),
  },
});

export type TodayStackParams = StaticParamList<typeof TodayStack>;
