import React, {useEffect} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useStore} from '../store';
import {useNavigationState} from '../hooks/navigation/useNavigationState';
import {type OnBoardingStackParamList} from './types';
import {CreateHomeScreen} from '../screens/onBoarding/createHome/CreateHomeScreen';
import {CreateShoppingListScreen} from '../screens/onBoarding/CreateShoppingListScreen';
import {SelectPantryItems} from '../screens/onBoarding/SelectPantryItems';
import {ProfilePictureUploadScreen} from '../screens/onBoarding/ProfilePictureUploadScreen';
import {InviteMembersScreen} from '../screens/onBoarding/InviteMemberScreen';
import {OnboardingCompleteScreen} from '../screens/onBoarding/OnboardingCompleteScreen';
import {OnBoardingSteps} from '../store/slices/preferencesSlice';

const Stack = createNativeStackNavigator<OnBoardingStackParamList>();

export const OnBoardingStack = () => {
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

  const getInitialRouteName = (): keyof OnBoardingStackParamList => {
    if (user?.onBoarded) {
      return 'OnboardingComplete';
    }
    return onboardingInitialRoute as keyof OnBoardingStackParamList;
  };

  const initialRoute = getInitialRouteName();

  // Remove the console.log in production
  if (__DEV__) {
    console.log('Onboarding initial route:', initialRoute);
  }

  return (
    <Stack.Navigator
      // REMOVE the dynamic key - it's causing remounts
      // key={`onboarding-${user?.id || 'anonymous'}-${getInitialRouteName()}`}
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}>
      <Stack.Screen name="CreateHome" component={CreateHomeScreen} />
      <Stack.Screen
        name="CreateShoppingList"
        component={CreateShoppingListScreen}
      />
      <Stack.Screen name="SelectPantryItems" component={SelectPantryItems} />
      <Stack.Screen
        name="ProfilePictureUpload"
        component={ProfilePictureUploadScreen}
      />
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
