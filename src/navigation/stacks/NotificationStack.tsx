import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { NotificationListScreen } from '#features/notifications/screens/NotificationListScreen';
import { NotificationDetailScreen } from '#features/notifications/screens/NotificationDetailScreen';
import { NotificationSettingsScreen } from '#features/notifications/screens/NotificationSettingsScreen';
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
    inactiveBehavior: 'none',
  }),
  screens: {
    NotificationList: createNativeStackScreen({
      screen: NotificationListScreen,
      linking: 'notifications',
    }),
    NotificationDetail: createNativeStackScreen({
      screen: NotificationDetailScreen,
      linking: 'notifications/:id',
    }),
    NotificationSettings: createNativeStackScreen({
      screen: NotificationSettingsScreen,
      linking: 'notifications/settings',
    }),
  },
});

export type NotificationStackParams = StaticParamList<typeof NotificationStack>;
