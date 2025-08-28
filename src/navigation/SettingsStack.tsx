import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {TouchableOpacity} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {ProfileScreen, NotificationSettingsScreen} from '#screens';
import {SettingsStackParamList} from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStack() {
  const {theme} = useUnistyles();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: styles.header,
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: styles.headerTitle,
      }}>
      <Stack.Screen
        name="ProfileSettings"
        component={ProfileScreen}
        options={({navigation}) => ({
          title: 'Profile',
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => {
                /* Handle edit profile */
              }}>
              <Icon name="edit" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          title: 'Notifications',
        }}
      />
    </Stack.Navigator>
  );
}

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
