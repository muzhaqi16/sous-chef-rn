import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import {HomeManagement} from '#screens';
import {HomeManagementStackParamList} from './types';

const Stack = createNativeStackNavigator<HomeManagementStackParamList>();

export const HomeManagementStack = () => {
  const {styles, theme} = useStyles(stylesheet);

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: styles.header,
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: styles.headerTitle,
      }}>
      <Stack.Screen
        name="HomeManagement"
        component={HomeManagement}
        options={({navigation}) => ({
          headerShown: false,
        })}
      />
    </Stack.Navigator>
  );
};

const stylesheet = createStyleSheet(theme => ({
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
