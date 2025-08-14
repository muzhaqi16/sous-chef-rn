import notifee, {AndroidImportance, AndroidStyle} from '@notifee/react-native';
import {Platform} from 'react-native';

interface LocalNotificationParams {
  id: string;
  title: string;
  body: string;
  priority?: 'high' | 'default' | 'low';
}

export const showLocalNotification = async ({
  id,
  title,
  body,
  priority = 'default',
}: LocalNotificationParams) => {
  try {
    // Create channel for Android
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: AndroidImportance.HIGH,
        vibration: true,
        lights: true,
      });
    }

    // Display the notification
    await notifee.displayNotification({
      id,
      title,
      body,
      ios: {
        sound: 'default',
        categoryId: 'default',
      },
      android: {
        channelId: 'default',
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        style:
          body.length > 50
            ? {
                type: AndroidStyle.BIGTEXT,
                text: body,
              }
            : undefined,
        smallIcon: 'ic_notification', // You'll need to add this to your Android resources
      },
    });
  } catch (error) {
    console.error('Failed to show local notification:', error);
  }
};

export const cancelNotification = async (notificationId: string) => {
  try {
    await notifee.cancelNotification(notificationId);
  } catch (error) {
    console.error('Failed to cancel notification:', error);
  }
};

export const cancelAllNotifications = async () => {
  try {
    await notifee.cancelAllNotifications();
  } catch (error) {
    console.error('Failed to cancel all notifications:', error);
  }
};

export const getBadgeCount = async (): Promise<number> => {
  if (Platform.OS === 'ios') {
    return await notifee.getBadgeCount();
  }
  return 0;
};

export const setBadgeCount = async (count: number) => {
  if (Platform.OS === 'ios') {
    await notifee.setBadgeCount(count);
  }
};

export const setupNotificationHandlers = () => {
  // Handle foreground notifications
  const unsubscribe = notifee.onForegroundEvent(({type, detail}) => {
    switch (type) {
      case 1: // PRESSED
        console.log('Notification pressed:', detail.notification);
        // Handle navigation based on notification data
        if (detail.notification?.data) {
          // Navigate to appropriate screen
        }
        break;
      case 0: // DELIVERED
        console.log('Notification delivered:', detail.notification);
        break;
      case 2: // DISMISSED
        console.log('Notification dismissed:', detail.notification);
        break;
    }
  });

  // Handle background events
  notifee.onBackgroundEvent(async ({type, detail}) => {
    if (type === 1) {
      // PRESSED
      console.log('Background notification pressed:', detail.notification);
      // Handle navigation when app opens from notification
    }
  });

  return unsubscribe;
};
