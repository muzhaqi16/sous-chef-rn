import { createNativeStackScreen } from '@react-navigation/native-stack';
import { NotificationListScreen } from './NotificationListScreen';
import { NotificationDetailScreen } from './NotificationDetailScreen';
import { NotificationSettingsScreen } from './NotificationSettingsScreen';

/**
 * The notifications feature's screens, composed into `NotificationStack`.
 *
 * Declared here rather than inline in the stack so the feature owns its own
 * screen list. The stack keeps the presentation decisions (animation, insets).
 *
 * A literal object, spread by the stack — see `barcodeScreens` for why that
 * matters to react-navigation's param inference.
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
