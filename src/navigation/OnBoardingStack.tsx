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
import {useUserData} from '#/hooks';
const Stack = createNativeStackNavigator<OnBoardingStackParamList>();

const OnBoardingStack = () => {
  const {onBoardingStep} = useStore();
  const {user} = useUserData();
  // Simple initial route determination
  const getInitialRouteName = (): keyof OnBoardingStackParamList => {
    if (user?.onBoarded) {
      return 'OnboardingComplete';
    }

    // Use the onBoardingStep as single source of truth
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
        return 'CreateHome'; // Default to first step
    }
  };

  return (
    <Stack.Navigator
      initialRouteName={getInitialRouteName()}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false, // Disable swipe back during onboarding
      }}>
      <Stack.Screen name="CreateHome" component={CreateHomeScreen} />
      <Stack.Screen
        name="CreateShoppingList"
        component={CreateShoppingListScreen}
      />
      <Stack.Screen name="SelectPantryItems" component={SelectPantryItems} />
      <Stack.Screen name="InviteMembers" component={InviteMembersScreen} />
      <Stack.Screen
        name="OnboardingComplete"
        component={OnboardingCompleteScreen}
        options={{
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default OnBoardingStack;
