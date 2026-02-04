import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { NotificationListScreen } from '#screens/notifications/NotificationListScreen';
import { NotificationDetailScreen } from '#screens/notifications/NotificationDetailScreen';
import { NotificationSettingsScreen } from '#screens/notifications/NotificationSettingsScreen';
import type {NotificationItem} from '#store/slices/notificationSlice';

export type NotificationStackParamList = {
  NotificationList: undefined;
  NotificationDetail: {notification: NotificationItem};
  NotificationSettings: undefined;
};

const Stack = createNativeStackNavigator<NotificationStackParamList>();

export const NotificationStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'fade_from_bottom',
      animationDuration: 200,
    }}
  >
    <Stack.Screen name="NotificationList" component={NotificationListScreen} />
    <Stack.Screen
      name="NotificationDetail"
      component={NotificationDetailScreen}
    />
    <Stack.Screen
      name="NotificationSettings"
      component={NotificationSettingsScreen}
    />
  </Stack.Navigator>
);
