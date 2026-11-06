import type { StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { onboardingScreens } from '#features/onboarding/screens/registration';
import { OnboardingSetupRunner } from '#features/onboarding/screens/OnboardingSetupRunner';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';
import { motion } from '#/theme/motion';

export const OnboardingStack = createNativeStackNavigator({
  // Setup runs beside the questions; its screen opens only for invitations.
  initialRouteName: 'Household',
  layout: ({ children, navigation }) => (
    <>
      <OnboardingSetupRunner navigation={navigation} />
      {children}
    </>
  ),
  // Per-screen top inset (see TopInsetLayout); nothing immersive here.
  screenLayout: topInsetScreenLayout,
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: motion.timing.MODERATE,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screens: { ...onboardingScreens },
});

export type OnboardingStackParams = StaticParamList<typeof OnboardingStack>;
