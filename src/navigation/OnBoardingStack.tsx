import React, {useEffect} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useStore} from '../store';
import {useNavigationState} from '../hooks/navigation/useNavigationState';
import {type OnBoardingStackParamList} from './types';
import {CreateHomeScreen} from '../screens/onBoarding/createHome/CreateHomeScreen';
import {CreateShoppingListScreen} from '../screens/onBoarding/CreateShoppingListScreen';
import {SelectPantryItems} from '../screens/onBoarding/SelectPantryItems';
import {InviteMembersScreen} from '../screens/onBoarding/InviteMemberScreen';
import {OnboardingCompleteScreen} from '../screens/onBoarding/OnboardingCompleteScreen';
import {OnBoardingSteps} from '../store/slices/preferencesSlice';

const Stack = createNativeStackNavigator<OnBoardingStackParamList>();

const OnBoardingStack = () => {
  const {user, onBoardingStep, setOnBoardingStep, setUserNavigationState} =
    useStore();

  const {onboardingInitialRoute, saveUserProgress} = useNavigationState();

  // Track onboarding progress for the user
  useEffect(() => {
    if (user?.id && onBoardingStep) {
      saveUserProgress({
        onboardingProgress: onBoardingStep,
      });
    }
  }, [user?.id, onBoardingStep, saveUserProgress]);

  // Map step to component for easier management
  const getInitialRouteName = (): keyof OnBoardingStackParamList => {
    if (user?.onBoarded) {
      return 'OnboardingComplete';
    }

    return onboardingInitialRoute as keyof OnBoardingStackParamList;
  };

  const handleStepChange = (newStep: OnBoardingSteps) => {
    setOnBoardingStep(newStep);

    // Save user-specific progress
    if (user?.id) {
      setUserNavigationState(user.id, {
        onboardingProgress: newStep,
      });
    }
  };

  console.log('Onboarding initial route:', getInitialRouteName());

  return (
    <Stack.Navigator
      key={`onboarding-${user?.id || 'anonymous'}`}
      initialRouteName={getInitialRouteName()}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false, // Disable swipe back during onboarding
      }}>
      <Stack.Screen
        name="CreateHome"
        component={CreateHomeScreen}
        listeners={{
          beforeRemove: () => {
            handleStepChange(OnBoardingSteps.createHome);
          },
        }}
      />
      <Stack.Screen
        name="CreateShoppingList"
        component={CreateShoppingListScreen}
        listeners={{
          beforeRemove: () => {
            handleStepChange(OnBoardingSteps.createShoppingList);
          },
        }}
      />
      <Stack.Screen
        name="SelectPantryItems"
        component={SelectPantryItems}
        listeners={{
          beforeRemove: () => {
            handleStepChange(OnBoardingSteps.selectPantryItems);
          },
        }}
      />
      <Stack.Screen
        name="InviteMembers"
        component={InviteMembersScreen}
        listeners={{
          beforeRemove: () => {
            handleStepChange(OnBoardingSteps.inviteMembers);
          },
        }}
      />
      <Stack.Screen
        name="OnboardingComplete"
        component={OnboardingCompleteScreen}
        options={{
          animation: 'fade',
          gestureEnabled: false,
        }}
        listeners={{
          beforeRemove: () => {
            handleStepChange(OnBoardingSteps.complete);
          },
        }}
      />
    </Stack.Navigator>
  );
};

export default OnBoardingStack;
