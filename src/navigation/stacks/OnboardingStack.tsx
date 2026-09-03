import type { StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onboardingScreens } from '#features/onboarding/screens/registration';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

export const OnboardingStack = createNativeStackNavigator({
  // Per-screen top inset (see TopInsetLayout); nothing immersive here.
  screenLayout: topInsetScreenLayout,
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screens: { ...onboardingScreens },
});

export type OnboardingStackParams = StaticParamList<typeof OnboardingStack>;
