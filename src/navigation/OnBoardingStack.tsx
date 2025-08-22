// src/navigation/OnBoardingStack.tsx
import React, {useEffect} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useStore} from '../store';
import {type OnBoardingStackParamList} from './types';
import {CreateHomeScreen} from '../screens/onBoarding/CreateHomeScreen';
import {CreateShoppingListScreen} from '../screens/onBoarding/CreateShoppingListScreen';
import {SelectPantryItems} from '../screens/onBoarding/SelectPantryItems';
import {InviteMembersScreen} from '../screens/onBoarding/InviteMemberScreen';
import {OnboardingCompleteScreen} from '../screens/onBoarding/OnboardingCompleteScreen';
import {OnBoardingSteps} from '../store/slices/preferencesSlice';
import {useGetHomesQuery, useGetShoppingListsQuery} from '#generated';
import {useFocusEffect} from '@react-navigation/native';

const Stack = createNativeStackNavigator<OnBoardingStackParamList>();

const OnBoardingStack = () => {
  const {
    onBoardingStep,
    user,
    setOnBoardingStep,
    setSelectedHomeId,
    setSelectedShoppingListId,
  } = useStore();
  const onBoarded = user?.onBoarded ?? false;

  // Query existing entities to determine proper navigation
  const {data: homesData, loading: homesLoading} = useGetHomesQuery({
    skip: !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  const {data: listsData, loading: listsLoading} = useGetShoppingListsQuery({
    skip: !user?.id,
    fetchPolicy: 'cache-and-network',
  });

  const homes = homesData?.homes || [];
  const lists = listsData?.shoppingLists || [];

  console.log(
    'OnBoardingStack - onBoardingStep:',
    onBoardingStep,
    'onBoarded:',
    onBoarded,
  );
  console.log('OnBoardingStack - homes:', homes.length, 'lists:', lists.length);

  // Auto-advance onboarding based on existing entities
  useEffect(() => {
    if (homesLoading || listsLoading || !user?.id) return;

    let shouldAdvance = false;
    let newStep: OnBoardingSteps = onBoardingStep ?? OnBoardingSteps.createHome;

    // If user has homes but onboarding step is still on create home, advance
    if (
      homes.length > 0 &&
      (!onBoardingStep || onBoardingStep === OnBoardingSteps.createHome)
    ) {
      console.log('User has homes, advancing past createHome step');
      // Set the first home as selected if none is selected
      if (!useStore.getState().selectedHomeId) {
        setSelectedHomeId(homes[0].id);
      }
      newStep = OnBoardingSteps.createShoppingList;
      shouldAdvance = true;
    }

    // If user has shopping lists but onboarding step is on create shopping list, advance
    if (lists.length > 0 && newStep === OnBoardingSteps.createShoppingList) {
      console.log(
        'User has shopping lists, advancing past createShoppingList step',
      );
      // Set the first list as selected if none is selected
      if (!useStore.getState().selectedShoppingListId) {
        setSelectedShoppingListId(lists[0].id);
      }
      newStep = OnBoardingSteps.selectPantryItems;
      shouldAdvance = true;
    }

    if (shouldAdvance && newStep !== onBoardingStep) {
      console.log('Auto-advancing onboarding step to:', newStep);
      setOnBoardingStep(newStep);
    }
  }, [
    homes,
    lists,
    homesLoading,
    listsLoading,
    onBoardingStep,
    user?.id,
    setOnBoardingStep,
    setSelectedHomeId,
    setSelectedShoppingListId,
  ]);

  // Set the initial route based on the onboarding step or completion status that the user has reached
  const getInitialRouteName = (): keyof OnBoardingStackParamList => {
    if (onBoarded) {
      return 'OnboardingComplete';
    }

    // If we have entities, skip the creation steps
    if (homes.length > 0 && lists.length > 0) {
      switch (onBoardingStep) {
        case OnBoardingSteps.selectPantryItems:
          return 'SelectPantryItems';
        case OnBoardingSteps.inviteMembers:
          return 'InviteMembers';
        case OnBoardingSteps.complete:
          return 'OnboardingComplete';
        default:
          return 'SelectPantryItems';
      }
    } else if (homes.length > 0) {
      // Has homes but no shopping lists
      switch (onBoardingStep) {
        case OnBoardingSteps.createShoppingList:
          return 'CreateShoppingList';
        case OnBoardingSteps.selectPantryItems:
          return 'SelectPantryItems';
        case OnBoardingSteps.inviteMembers:
          return 'InviteMembers';
        case OnBoardingSteps.complete:
          return 'OnboardingComplete';
        default:
          return 'CreateShoppingList';
      }
    }

    // Default flow when no entities exist
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

  // Prevent navigation if data is still loading
  if (homesLoading || listsLoading) {
    return null; // or a loading spinner
  }

  return (
    <Stack.Navigator
      key={`${initialRouteName}-${onBoardingStep}`}
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationTypeForReplace: 'push',
        gestureEnabled: false, // Disable swipe gestures to prevent going back
        gestureDirection: 'horizontal',
      }}>
      <Stack.Screen
        name="CreateHome"
        component={CreateHomeScreen}
        options={{
          headerShown: false,
          animation: 'fade_from_bottom',
          gestureEnabled: false, // Explicitly disable gestures
        }}
      />
      <Stack.Screen
        name="CreateShoppingList"
        component={CreateShoppingListScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="SelectPantryItems"
        component={SelectPantryItems}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="InviteMembers"
        component={InviteMembersScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="OnboardingComplete"
        component={OnboardingCompleteScreen}
        options={{
          headerShown: false,
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default OnBoardingStack;
