import { createNativeStackScreen } from '@react-navigation/native-stack';
import { NotificationListScreen } from './NotificationListScreen';
import { NotificationDetailScreen } from './NotificationDetailScreen';
import { NotificationSettingsScreen } from './NotificationSettingsScreen';

/**
 * The notifications feature's screens, spread into `NotificationStack` (which
 * keeps the presentation decisions). Must stay a literal — see `barcodeScreens`
 * for react-navigation's param inference.
 */
export const notificationScreens = {
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
};
