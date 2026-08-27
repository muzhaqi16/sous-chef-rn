import type { StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { notificationScreens } from '#features/notifications/screens/registration';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

export const NotificationStack = createNativeStackNavigator({
  // Top safe-area inset, applied per screen (it's no longer global — see
  // TopInsetLayout). No immersive screen here, so inset every screen.
  screenLayout: topInsetScreenLayout,
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'fade_from_bottom',
    animationDuration: 200,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screens: { ...notificationScreens },
});

export type NotificationStackParams = StaticParamList<typeof NotificationStack>;
