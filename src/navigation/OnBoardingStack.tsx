import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useStore} from '../store';
import {type OnBoardingStackParamList} from './types';
import {CreateHomeScreen} from '../screens/onBoarding/CreateHomeScreen';
import {CreateShoppingListScreen} from '../screens/onBoarding/CreateShoppingListScreen';
import {SelectPantryItems} from '../screens/onBoarding/SelectPantryItems';
import {InviteMembersScreen} from '../screens/onBoarding/InviteMemberScreen';
import {OnboardingCompleteScreen} from '../screens/onBoarding/OnboardingCompleteScreen';
import {OnBoardingSteps} from '../store/slices/preferencesSlice';

const Stack = createNativeStackNavigator<OnBoardingStackParamList>();

const OnBoardingStack = () => {
  const {onBoardingStep, user} = useStore();
  const onBoarded = user?.onBoarded ?? false;

  // Set the initial route based on the onboarding step or completion status that the user has reached
  const getInitialRouteName = (): keyof OnBoardingStackParamList => {
    if (onBoarded) {
      return 'OnboardingComplete';
    }

    switch (onBoardingStep) {
      case OnBoardingSteps.createHome:
        return 'CreateHome';
      case OnBoardingSteps.createShoppingList:
        return 'CreateShoppingList';
      case OnBoardingSteps.selectPantryItems:
        return 'SelectPantryItems';
      case OnBoardingSteps.inviteMembers:
        return 'InviteMembers';
      case OnBoardingSteps.complete:
        return 'OnboardingComplete';
      default:
        return 'CreateHome'; // Start from the beginning
    }
  };

  const initialRouteName = getInitialRouteName();

  return (
    <Stack.Navigator
      key={initialRouteName}
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationTypeForReplace: 'push',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}>
      <Stack.Screen
        name="CreateHome"
        component={CreateHomeScreen}
        options={{
          headerShown: false,
          animation: 'fade_from_bottom', // First screen fades in
        }}
      />
      <Stack.Screen
        name="CreateShoppingList"
        component={CreateShoppingListScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="SelectPantryItems"
        component={SelectPantryItems}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="InviteMembers"
        component={InviteMembersScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="OnboardingComplete"
        component={OnboardingCompleteScreen}
        options={{
          headerShown: false,
          animation: 'fade', // Final screen fades in
        }}
      />
    </Stack.Navigator>
  );
};

export default OnBoardingStack;
