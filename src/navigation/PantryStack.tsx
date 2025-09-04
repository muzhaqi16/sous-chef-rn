import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {
  PantryMain,
  ExpiringItems,
  AddPantryItem,
  PantryItemDetail,
  LowStockItems,
  CategoryManagement,
  EditPantryItem,
} from '#screens';
import {PantryStackParamList} from './types';
import {useNavigation} from '@react-navigation/native';

const Stack = createNativeStackNavigator<PantryStackParamList>();

export function PantryStack() {
  const navigation = useNavigation();
  const {theme} = useUnistyles();
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
        component={EditPantryItem}
        options={{
          headerShown: false,
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
