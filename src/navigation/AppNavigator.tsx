import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer} from '@react-navigation/native';
import MainScreen from '../screens/MainScreen';
import AuthScreen from '../screens/AuthScreen';
import ShoppingListScreen from '../screens/ShoppingListScreen';
import {useStore} from '../store/useStore';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const {user} = useStore();

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen
              name="ShoppingList"
              component={ShoppingListScreen}
              options={{title: 'Shopping List', headerShown: false}}
            />
            <Stack.Screen
              name="Main"
              component={MainScreen}
              options={{headerShown: false}}
            />
          </>
        ) : (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{headerShown: false}}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
