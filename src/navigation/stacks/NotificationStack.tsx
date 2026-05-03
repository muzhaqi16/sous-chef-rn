import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { NotificationListScreen } from '#features/notifications/screens/NotificationListScreen';
import { NotificationDetailScreen } from '#features/notifications/screens/NotificationDetailScreen';
import { NotificationSettingsScreen } from '#features/notifications/screens/NotificationSettingsScreen';

export const NotificationStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'fade_from_bottom',
    animationDuration: 200,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
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
