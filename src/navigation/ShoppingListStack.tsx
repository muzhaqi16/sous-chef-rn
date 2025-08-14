import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {TouchableOpacity} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import {ShoppingListMain} from '#screens';
import {ShoppingListDetail} from '#/screens/shoppingList/ShoppingListDetail';
import {ListSettings} from '#/screens/shoppingList/ListSettings';
import {ShoppingListStackParamList} from './types';
import {ShareList, AddEditItem} from '#/screens';

const Stack = createNativeStackNavigator<ShoppingListStackParamList>();

export function ShoppingListStack() {
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
        name="ShoppingListMain"
        component={ShoppingListMain}
        options={({navigation}) => ({
          headerShown: false,
        })}
      />
      <Stack.Screen
        name="ShoppingListDetail"
        component={ShoppingListDetail}
        options={({route}) => ({
          headerShown: false,
        })}
      />

      <Stack.Screen
        name="ListSettings"
        component={ListSettings}
        options={({route}) => ({
          title: 'List Settings',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.headerButton}>
              <Icon
                name="arrow-back"
                size={24}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="ShareList"
        component={ShareList} // Assuming ShareList is handled in ShoppingListDetail
        options={({route}) => ({
          title: 'Share List',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.headerButton}>
              <Icon
                name="arrow-back"
                size={24}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="AddItem"
        component={AddEditItem}
        options={({route}) => ({
          // TODO: Use route params to determine if it's an edit or add
          title: route.params ? 'Edit Item' : 'Add Item',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.headerButton}>
              <Icon
                name="arrow-back"
                size={24}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>
          ),
        })}
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
