import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useStore} from '../store';
import {type OnBoardingStackParamList} from './types';
import {LoginScreen, SignUpScreen, ForgotPasswordScreen} from '../screens/Auth';
import {CreateShoppingListScreen} from '../screens/OnBoarding/CreateShoppingList';
import {SelectPantryItems} from '../screens/OnBoarding/SelectPantryItems';

const Stack = createNativeStackNavigator<OnBoardingStackParamList>();

const OnboardingStack = () => {
  const {user} = useStore();
  console.log('OnboardingStack user:', user);
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,

        // pick one of the native presets:
        // animation: 'fade_from_bottom', // fade in from bottom
        // animation: 'fade',               // simple cross-fade
        // animation: 'slide_from_right',   // slide in from the right
        // animation: 'slide_from_left',    // slide in from the left
        // animation: 'slide_from_bottom',  // slide in from the bottom
        // animation: 'flip',               // iOS only, with presentation: 'modal'
        // animation: 'none',               // no animation at all

        // if you ever do a replace(), you can pick its animation too
        animationTypeForReplace: 'push', // or 'pop'

        // you can also tweak gesture directions if you like:
        gestureEnabled: true,
        gestureDirection: 'vertical', // vertical swipe to dismiss
      }}>
      <Stack.Screen
        name="CreateShoppingList"
        component={CreateShoppingListScreen}
        options={{headerShown: false, animation: 'slide_from_left'}}
      />
      <Stack.Screen
        name="SelectPantryItems"
        component={SelectPantryItems}
        options={{headerShown: false, animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="AddFriends"
        component={ForgotPasswordScreen}
        options={{headerShown: false, animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="AddProfilePicture"
        component={LoginScreen}
        options={{headerShown: false, animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="OnBoardingCompleted"
        component={SignUpScreen}
        options={{headerShown: false, animation: 'slide_from_right'}}
      />
    </Stack.Navigator>
  );
};

export default OnboardingStack;
