import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { NotificationListScreen } from '#screens/notifications/NotificationListScreen';
import { NotificationDetailScreen } from '#screens/notifications/NotificationDetailScreen';
import { NotificationSettingsScreen } from '#screens/notifications/NotificationSettingsScreen';

export const NotificationStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    animation: 'fade_from_bottom',
    animationDuration: 200,
  },
  screens: {
    NotificationList: {
      screen: NotificationListScreen,
      linking: 'notifications',
    },
    NotificationDetail: {
      screen: NotificationDetailScreen,
      linking: 'notifications/:id',
    },
    NotificationSettings: {
      screen: NotificationSettingsScreen,
      linking: 'notifications/settings',
    },
  },
});
