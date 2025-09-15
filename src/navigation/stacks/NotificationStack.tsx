import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  NotificationListScreen,
  NotificationDetailScreen,
  NotificationSettingsScreen,
} from '#screens/notifications';
import type {NotificationItem} from '#store/slices/notificationSlice';

export type NotificationStackParamList = {
  NotificationList: undefined;
  NotificationDetail: {notification: NotificationItem};
  NotificationSettings: undefined;
};

const Stack = createNativeStackNavigator<NotificationStackParamList>();

export const NotificationStack = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
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
