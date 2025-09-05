import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {
  NotificationListScreen,
  NotificationDetailScreen,
  NotificationSettingsScreen,
} from '#screens';
import {NotificationStackParamList} from './types';

const Stack = createNativeStackNavigator<NotificationStackParamList>();

export const NotificationStack = () => {
  const {theme} = useUnistyles();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: styles.header,
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: styles.headerTitle,
      }}>
      <Stack.Screen
        name="NotificationList"
        component={NotificationListScreen}
        options={({}) => ({
          headerShown: false,
        })}
      />
      <Stack.Screen
        name="NotificationDetail"
        component={NotificationDetailScreen}
        options={{
          title: 'Details',
        }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          title: 'Notification Settings',
        }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    backgroundColor: theme.colors.surface,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  headerButton: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
}));
