import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {TouchableOpacity} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import {
  PantryMain,
  ExpiringItems,
  AddPantryItem,
  PantryItemDetail,
  LowStockItems,
  CategoryManagement,
  HomeManagement,
} from '#screens';
import {PantryStackParamList} from './types';
import {useNavigation} from '@react-navigation/native';

const Stack = createNativeStackNavigator<PantryStackParamList>();

export function PantryStack() {
  const {styles, theme} = useStyles(stylesheet);
  const navigation = useNavigation();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: styles.header,
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: styles.headerTitle,
      }}>
      <Stack.Screen
        name="PantryMain"
        component={PantryMain}
        options={({navigation}) => ({
          headerShown: false,
        })}
      />
      <Stack.Screen
        name="AddPantryItem"
        component={AddPantryItem}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PantryItemDetail"
        component={PantryItemDetail}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="EditPantryItem"
        component={AddPantryItem}
        options={{
          title: 'Edit Pantry Item',
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.goBack()}>
              <Icon
                name="arrow-back"
                size={24}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="ExpiringItems"
        component={ExpiringItems}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="LowStockItems"
        component={LowStockItems}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CategoryManagement"
        component={CategoryManagement}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
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
