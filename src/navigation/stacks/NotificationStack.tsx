import type { StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { notificationScreens } from '#features/notifications/screens/registration';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';
import { motion } from '#/theme/foundations/motion';

export const NotificationStack = createNativeStackNavigator({
  // Per-screen top inset (see TopInsetLayout); nothing immersive here.
  screenLayout: topInsetScreenLayout,
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'fade_from_bottom',
    animationDuration: motion.timing.STANDARD,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screens: { ...notificationScreens },
});

export type NotificationStackParams = StaticParamList<typeof NotificationStack>;
