import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer} from '@react-navigation/native';
import {useStore} from '../store/useStore';
import {CreateShoppingListScreen} from '../screens/OnBoarding/CreateShoppingList';
import {type RootStackParamList} from './types';
import HomeTab from './TabNavigator';
import AuthStack from './AuthStack';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const {user, onBoardingCompleted} = useStore();
  const isSignedIn = !!user;
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {isSignedIn ? (
          <>
            {!onBoardingCompleted && (
              <Stack.Screen
                name="OnBoarding"
                component={CreateShoppingListScreen}
                options={{headerShown: false}}
              />
            )}
            <Stack.Screen
              name="Home"
              component={HomeTab}
              options={{headerShown: false}}
            />
          </>
        ) : (
          <Stack.Screen
            name="Auth"
            component={AuthStack}
            options={{headerShown: false}}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
